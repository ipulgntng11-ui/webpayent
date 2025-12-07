// State aplikasi
const AppState = {
    currentDeposit: null,
    transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
    selectedAmount: 0,
    pollingInterval: null,
    countdownInterval: null
};

// DOM Elements
const DOM = {
    // Header
    userBalance: document.getElementById('userBalance'),
    refreshBalance: document.getElementById('refreshBalance'),
    
    // Status
    statusBar: document.getElementById('statusBar'),
    closeStatus: document.getElementById('closeStatus'),
    
    // Deposit Form
    depositForm: document.getElementById('depositForm'),
    amountButtons: document.querySelectorAll('.amount-btn'),
    customAmount: document.getElementById('customAmount'),
    nominalAmount: document.getElementById('nominalAmount'),
    feeAmount: document.getElementById('feeAmount'),
    totalAmount: document.getElementById('totalAmount'),
    receivedAmount: document.getElementById('receivedAmount'),
    createDepositBtn: document.getElementById('createDepositBtn'),
    
    // QRIS Display
    paymentStatus: document.getElementById('paymentStatus'),
    qrisContainer: document.getElementById('qrisContainer'),
    transactionInfo: document.getElementById('transactionInfo'),
    actionButtons: document.getElementById('actionButtons'),
    timerContainer: document.getElementById('timerContainer'),
    timerText: document.getElementById('timerText'),
    
    // History
    refreshHistory: document.getElementById('refreshHistory'),
    historyList: document.getElementById('historyList'),
    
    // Notification & Loading
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    loadingOverlay: document.getElementById('loadingOverlay')
};

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Tampilkan notifikasi
function showNotification(message, type = 'success') {
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 'fa-exclamation-triangle';
    
    DOM.notificationMessage.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    DOM.notification.className = `notification ${type}`;
    DOM.notification.classList.add('show');
    
    setTimeout(() => {
        DOM.notification.classList.remove('show');
    }, 3000);
}

// Tampilkan loading
function showLoading(show = true) {
    if (show) {
        DOM.loadingOverlay.classList.add('active');
    } else {
        DOM.loadingOverlay.classList.remove('active');
    }
}

// Update summary display
function updateSummary(amount) {
    if (!amount || amount < 10000) {
        DOM.nominalAmount.textContent = 'Rp 0';
        DOM.feeAmount.textContent = 'Rp 0';
        DOM.totalAmount.textContent = 'Rp 0';
        DOM.receivedAmount.textContent = 'Rp 0';
        DOM.createDepositBtn.disabled = true;
        return;
    }
    
    const { nominal, fee, total, received } = API.calculateFee(amount);
    
    DOM.nominalAmount.textContent = formatCurrency(nominal);
    DOM.feeAmount.textContent = formatCurrency(fee);
    DOM.totalAmount.textContent = formatCurrency(total);
    DOM.receivedAmount.textContent = formatCurrency(received);
    DOM.createDepositBtn.disabled = false;
}

// Pilih nominal dari tombol
function selectAmount(amount) {
    AppState.selectedAmount = parseInt(amount);
    
    // Update tombol aktif
    DOM.amountButtons.forEach(btn => {
        if (parseInt(btn.dataset.amount) === AppState.selectedAmount) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update custom amount
    DOM.customAmount.value = amount;
    
    // Update summary
    updateSummary(amount);
}

// Buat deposit
async function createDeposit() {
    if (AppState.selectedAmount < 10000 || AppState.selectedAmount > 5000000) {
        showNotification('Nominal harus antara Rp 10.000 - Rp 5.000.000', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const result = await API.createDeposit(AppState.selectedAmount, 'QRISFAST');
        
        if (result.success) {
            AppState.currentDeposit = result.data;
            
            // Simpan ke local storage
            const transaction = {
                id: result.data.id,
                amount: result.data.nominal,
                fee: result.data.fee,
                received: result.data.get_balance,
                status: 'pending',
                created_at: result.data.created_at,
                expired_at: result.data.expired_at,
                timestamp: new Date().toISOString()
            };
            
            AppState.transactions.unshift(transaction);
            localStorage.setItem('transactions', JSON.stringify(AppState.transactions));
            
            // Tampilkan QRIS
            displayQRIS(result.data);
            
            // Mulai polling status
            startPollingStatus(result.data.id);
            
            // Mulai countdown
            startCountdown(result.data.expired_at);
            
            showNotification('QRIS berhasil dibuat! Scan untuk membayar', 'success');
            renderHistory();
            
        } else {
            showNotification(`Gagal membuat deposit: ${result.message}`, 'error');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Tampilkan QRIS
function displayQRIS(depositData) {
    // Update status badge
    DOM.paymentStatus.textContent = 'Menunggu';
    DOM.paymentStatus.style.background = 'rgba(247, 37, 133, 0.2)';
    DOM.paymentStatus.style.color = 'var(--warning)';
    DOM.paymentStatus.style.border = '1px solid var(--warning)';
    
    // Tampilkan QR code
    DOM.qrisContainer.innerHTML = `
        <div class="qr-code">
            <img src="${depositData.qr_image}" alt="QR Code" 
                 onerror="this.src='https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(depositData.qr_string || depositData.id)}'">
        </div>
        <p><i class="fas fa-qrcode"></i> Scan QR di atas untuk membayar via QRIS</p>
    `;
    DOM.qrisContainer.classList.add('active');
    
    // Tampilkan info transaksi
    DOM.transactionInfo.innerHTML = `
        <div class="info-row">
            <span class="info-label">ID Transaksi</span>
            <span class="info-value">${depositData.id.substring(0, 12)}...</span>
        </div>
        <div class="info-row">
            <span class="info-label">Nominal</span>
            <span class="info-value">${formatCurrency(depositData.nominal)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Biaya</span>
            <span class="info-value">${formatCurrency(depositData.fee)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Diterima</span>
            <span class="info-value success">${formatCurrency(depositData.get_balance)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value pending">MENUNGGU</span>
        </div>
        <div class="info-row">
            <span class="info-label">Dibuat</span>
            <span class="info-value">${new Date(depositData.created_at).toLocaleString('id-ID')}</span>
        </div>
    `;
    DOM.transactionInfo.classList.add('active');
    
    // Tampilkan tombol aksi
    DOM.actionButtons.innerHTML = `
        <button class="btn-action btn-success" onclick="checkStatus()">
            <i class="fas fa-sync-alt"></i> Cek Status
        </button>
        <button class="btn-action btn-danger" onclick="cancelDeposit()">
            <i class="fas fa-times"></i> Batalkan
        </button>
    `;
    DOM.actionButtons.classList.add('active');
    
    // Tampilkan timer
    DOM.timerContainer.classList.add('active');
}

// Mulai polling status
function startPollingStatus(depositId) {
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
    }
    
    AppState.pollingInterval = setInterval(async () => {
        await checkStatus();
    }, 10000); // Cek setiap 10 detik
}

// Mulai countdown
function startCountdown(expiredAt) {
    if (AppState.countdownInterval) {
        clearInterval(AppState.countdownInterval);
    }
    
    const updateTimer = () => {
        const now = new Date();
        const expired = new Date(expiredAt);
        const diff = expired - now;
        
        if (diff <= 0) {
            DOM.timerText.textContent = 'Waktu habis!';
            clearInterval(AppState.countdownInterval);
            return;
        }
        
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        DOM.timerText.textContent = `Waktu tersisa: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    updateTimer();
    AppState.countdownInterval = setInterval(updateTimer, 1000);
}

// Cek status deposit
async function checkStatus() {
    if (!AppState.currentDeposit) return;
    
    showLoading(true);
    
    try {
        const result = await API.checkDepositStatus(AppState.currentDeposit.id);
        
        if (result.success) {
            const status = result.data.status;
            
            // Update UI berdasarkan status
            switch (status) {
                case 'success':
                    handleSuccess(result.data);
                    break;
                case 'cancel':
                    handleCancel(result.data);
                    break;
                case 'expired':
                    handleExpired(result.data);
                    break;
                default:
                    // Masih pending, update UI
                    updateTransactionInfo(result.data);
                    showNotification('Masih menunggu pembayaran...', 'warning');
            }
        } else {
            showNotification(`Gagal cek status: ${result.message}`, 'error');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Handle success
function handleSuccess(data) {
    // Hentikan polling dan timer
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
        AppState.pollingInterval = null;
    }
    if (AppState.countdownInterval) {
        clearInterval(AppState.countdownInterval);
        AppState.countdownInterval = null;
    }
    
    // Update status badge
    DOM.paymentStatus.textContent = 'Berhasil';
    DOM.paymentStatus.style.background = 'rgba(76, 201, 240, 0.2)';
    DOM.paymentStatus.style.color = 'var(--success)';
    DOM.paymentStatus.style.border = '1px solid var(--success)';
    
    // Update transaction info
    updateTransactionInfo(data);
    
    // Update tombol aksi
    DOM.actionButtons.innerHTML = `
        <button class="btn-action btn-success" onclick="resetForm()" style="flex: 1">
            <i class="fas fa-redo"></i> Buat Deposit Baru
        </button>
    `;
    
    // Sembunyikan timer
    DOM.timerContainer.classList.remove('active');
    
    // Update transaksi di history
    const index = AppState.transactions.findIndex(t => t.id === data.id);
    if (index !== -1) {
        AppState.transactions[index].status = 'success';
        localStorage.setItem('transactions', JSON.stringify(AppState.transactions));
        renderHistory();
    }
    
    // Update saldo (simulasi)
    updateBalance();
    
    showNotification('Pembayaran berhasil! Saldo telah ditambahkan', 'success');
}

// Handle cancel
function handleCancel(data) {
    // Hentikan polling dan timer
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
        AppState.pollingInterval = null;
    }
    if (AppState.countdownInterval) {
        clearInterval(AppState.countdownInterval);
        AppState.countdownInterval = null;
    }
    
    // Update status
    DOM.paymentStatus.textContent = 'Dibatalkan';
    DOM.paymentStatus.style.background = 'rgba(255, 0, 110, 0.2)';
    DOM.paymentStatus.style.color = 'var(--danger)';
    DOM.paymentStatus.style.border = '1px solid var(--danger)';
    
    // Update transaction info
    updateTransactionInfo(data);
    
    // Update tombol aksi
    DOM.actionButtons.innerHTML = `
        <button class="btn-action btn-success" onclick="resetForm()" style="flex: 1">
            <i class="fas fa-redo"></i> Coba Lagi
        </button>
    `;
    
    // Sembunyikan timer
    DOM.timerContainer.classList.remove('active');
    
    // Update transaksi di history
    const index = AppState.transactions.findIndex(t => t.id === data.id);
    if (index !== -1) {
        AppState.transactions[index].status = 'cancel';
        localStorage.setItem('transactions', JSON.stringify(AppState.transactions));
        renderHistory();
    }
    
    showNotification('Deposit dibatalkan', 'error');
}

// Handle expired
function handleExpired(data) {
    // Hentikan polling dan timer
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
        AppState.pollingInterval = null;
    }
    if (AppState.countdownInterval) {
        clearInterval(AppState.countdownInterval);
        AppState.countdownInterval = null;
    }
    
    // Update status
    DOM.paymentStatus.textContent = 'Expired';
    DOM.paymentStatus.style.background = 'rgba(255, 165, 0, 0.2)';
    DOM.paymentStatus.style.color = 'orange';
    DOM.paymentStatus.style.border = '1px solid orange';
    
    // Update transaction info
    updateTransactionInfo(data);
    
    // Update tombol aksi
    DOM.actionButtons.innerHTML = `
        <button class="btn-action btn-success" onclick="resetForm()" style="flex: 1">
            <i class="fas fa-redo"></i> Buat Baru
        </button>
    `;
    
    // Sembunyikan timer
    DOM.timerContainer.classList.remove('active');
    
    // Update transaksi di history
    const index = AppState.transactions.findIndex(t => t.id === data.id);
    if (index !== -1) {
        AppState.transactions[index].status = 'expired';
        localStorage.setItem('transactions', JSON.stringify(AppState.transactions));
        renderHistory();
    }
    
    showNotification('Waktu pembayaran telah habis', 'warning');
}

// Update transaction info
function updateTransactionInfo(data) {
    const statusText = data.status === 'success' ? 'BERHASIL' : 
                      data.status === 'cancel' ? 'DIBATALKAN' :
                      data.status === 'expired' ? 'EXPIRED' : 'MENUNGGU';
    
    const statusClass = data.status === 'success' ? 'success' : 
                       data.status === 'cancel' ? 'danger' : 
                       data.status === 'expired' ? 'warning' : 'pending';
    
    DOM.transactionInfo.innerHTML = `
        <div class="info-row">
            <span class="info-label">ID Transaksi</span>
            <span class="info-value">${data.id.substring(0, 12)}...</span>
        </div>
        <div class="info-row">
            <span class="info-label">Nominal</span>
            <span class="info-value">${formatCurrency(data.nominal)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Diterima</span>
            <span class="info-value success">${formatCurrency(data.get_balance)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value ${statusClass}">${statusText}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Terakhir Diperbarui</span>
            <span class="info-value">${new Date().toLocaleString('id-ID')}</span>
        </div>
    `;
}

// Batalkan deposit
async function cancelDeposit() {
    if (!AppState.currentDeposit || !confirm('Apakah Anda yakin ingin membatalkan deposit ini?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        const result = await API.cancelDeposit(AppState.currentDeposit.id);
        
        if (result.success) {
            handleCancel(result.data);
        } else {
            showNotification(`Gagal membatalkan: ${result.message}`, 'error');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Reset form
function resetForm() {
    AppState.currentDeposit = null;
    AppState.selectedAmount = 0;
    
    // Reset form
    DOM.amountButtons.forEach(btn => btn.classList.remove('active'));
    DOM.customAmount.value = '';
    updateSummary(0);
    
    // Reset QRIS display
    DOM.paymentStatus.textContent = 'Tidak Aktif';
    DOM.paymentStatus.style.background = '';
    DOM.paymentStatus.style.color = '';
    DOM.paymentStatus.style.border = '';
    
    DOM.qrisContainer.classList.remove('active');
    DOM.transactionInfo.classList.remove('active');
    DOM.actionButtons.classList.remove('active');
    DOM.timerContainer.classList.remove('active');
    
    // Hentikan interval
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
        AppState.pollingInterval = null;
    }
    if (AppState.countdownInterval) {
        clearInterval(AppState.countdownInterval);
        AppState.countdownInterval = null;
    }
}

// Render history
function renderHistory() {
    if (AppState.transactions.length === 0) {
        DOM.historyList.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-clock"></i>
                <p>Belum ada transaksi</p>
            </div>
        `;
        return;
    }
    
    // Batasi 10 transaksi terakhir
    const recentTransactions = AppState.transactions.slice(0, 10);
    
    DOM.historyList.innerHTML = recentTransactions.map(transaction => {
        const date = new Date(transaction.timestamp).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusClass = transaction.status === 'success' ? 'status-success' :
                          transaction.status === 'pending' ? 'status-pending' :
                          'status-failed';
        
        return `
            <div class="history-item">
                <div class="history-left">
                    <div class="history-id">${transaction.id.substring(0, 12)}...</div>
                    <div class="history-date">${date}</div>
                </div>
                <div class="history-right">
                    <div class="history-amount">${formatCurrency(transaction.received)}</div>
                    <div class="history-status ${statusClass}">${transaction.status.toUpperCase()}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Update balance
async function updateBalance() {
    try {
        const result = await API.getUserBalance();
        if (result.success) {
            DOM.userBalance.textContent = formatCurrency(result.data.saldo);
        }
    } catch (error) {
        console.error('Failed to update balance:', error);
    }
}

// Initialize app
function initApp() {
    // Event listeners untuk tombol nominal
    DOM.amountButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectAmount(btn.dataset.amount);
        });
    });
    
    // Event listener untuk custom amount
    DOM.customAmount.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) || 0;
        if (value >= 10000) {
            selectAmount(value);
        }
    });
    
    // Event listener untuk form
    DOM.depositForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createDeposit();
    });
    
    // Event listener untuk refresh balance
    DOM.refreshBalance.addEventListener('click', updateBalance);
    
    // Event listener untuk close status
    DOM.closeStatus.addEventListener('click', () => {
        DOM.statusBar.style.display = 'none';
    });
    
    // Event listener untuk refresh history
    DOM.refreshHistory.addEventListener('click', () => {
        renderHistory();
        showNotification('Riwayat diperbarui', 'success');
    });
    
    // Initialize
    updateBalance();
    renderHistory();
    
    // Select default amount
    selectAmount(50000);
    
    // Show welcome notification
    setTimeout(() => {
        showNotification('Selamat datang di PAYMENT GATEWAY!', 'success');
    }, 1000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
