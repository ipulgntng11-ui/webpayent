// State aplikasi
const AppState = {
    currentTransaction: null,
    paymentMethods: [],
    transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
    selectedMethod: null,
    pollingInterval: null
};

// DOM Elements
const DOM = {
    paymentMethods: document.getElementById('paymentMethods'),
    paymentForm: document.getElementById('paymentForm'),
    nominalInput: document.getElementById('nominal'),
    metodeSelect: document.getElementById('metode'),
    feeAmount: document.getElementById('feeAmount'),
    netAmount: document.getElementById('netAmount'),
    feeInfo: document.getElementById('feeInfo'),
    createBtn: document.getElementById('createBtn'),
    transactionDetails: document.getElementById('transactionDetails'),
    qrContainer: document.getElementById('qrContainer'),
    transactionActions: document.getElementById('transactionActions'),
    transactionInfo: document.getElementById('transactionInfo'),
    transactionStatusBadge: document.getElementById('transactionStatusBadge'),
    transactionsList: document.getElementById('transactionsList'),
    statusBar: document.getElementById('statusBar'),
    closeStatus: document.getElementById('closeStatus'),
    refreshBtn: document.getElementById('refreshBtn'),
    refreshTransactions: document.getElementById('refreshTransactions'),
    statusModal: document.getElementById('statusModal'),
    closeModal: document.getElementById('closeModal'),
    statusResult: document.getElementById('statusResult'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage')
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
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    DOM.notificationMessage.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    DOM.notification.classList.add('show');
    
    setTimeout(() => {
        DOM.notification.classList.remove('show');
    }, 3000);
}

// Hitung biaya transaksi
function calculateFees(nominal, metode) {
    if (!metode) return { fee: 0, netAmount: nominal };
    
    const method = AppState.paymentMethods.find(m => m.metode === metode);
    if (!method) return { fee: 0, netAmount: nominal };
    
    const feePersen = parseFloat(method.fee_persen) || 0;
    const feeFixed = parseInt(method.fee) || 0;
    
    const fee = Math.floor(nominal * (feePersen / 100)) + feeFixed;
    const netAmount = nominal - fee;
    
    return { fee, netAmount };
}

// Update tampilan biaya
function updateFeeDisplay() {
    const nominal = parseInt(DOM.nominalInput.value) || 0;
    const metode = DOM.metodeSelect.value;
    
    if (nominal > 0 && metode) {
        const { fee, netAmount } = calculateFees(nominal, metode);
        DOM.feeAmount.textContent = formatCurrency(fee);
        DOM.netAmount.textContent = formatCurrency(netAmount);
        DOM.feeInfo.style.display = 'block';
    } else {
        DOM.feeInfo.style.display = 'none';
    }
}

// Load metode pembayaran
async function loadPaymentMethods() {
    try {
        DOM.paymentMethods.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Memuat metode pembayaran...</p>
            </div>
        `;
        
        const methods = await API.fetchPaymentMethods();
        AppState.paymentMethods = methods;
        
        renderPaymentMethods(methods);
        populateMethodSelect(methods);
        
        showNotification('Metode pembayaran berhasil dimuat');
    } catch (error) {
        DOM.paymentMethods.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <p>Gagal memuat metode pembayaran: ${error.message}</p>
                <button class="btn btn-outline" onclick="loadPaymentMethods()">
                    <i class="fas fa-redo"></i> Coba Lagi
                </button>
            </div>
        `;
    }
}

// Render metode pembayaran
function renderPaymentMethods(methods) {
    if (methods.length === 0) {
        DOM.paymentMethods.innerHTML = `
            <div class="empty-state small">
                <div class="empty-icon">
                    <i class="fas fa-qrcode"></i>
                </div>
                <p>Tidak ada metode QRIS tersedia</p>
            </div>
        `;
        return;
    }
    
    DOM.paymentMethods.innerHTML = methods.map(method => `
        <div class="payment-method ${AppState.selectedMethod === method.metode ? 'active' : ''}" 
             onclick="selectPaymentMethod('${method.metode}')">
            <div class="method-icon">
                <i class="fas fa-qrcode"></i>
            </div>
            <div class="method-info">
                <div class="method-name">${method.name}</div>
                <div class="method-limits">
                    ${formatCurrency(method.min)} - ${formatCurrency(method.max)}
                </div>
            </div>
            <div class="method-fee">
                Biaya: ${method.fee_persen}%
            </div>
        </div>
    `).join('');
}

// Populate select dropdown
function populateMethodSelect(methods) {
    DOM.metodeSelect.innerHTML = '<option value="">Pilih metode...</option>' +
        methods.map(method => `
            <option value="${method.metode}">
                ${method.name} (${method.fee_persen}% fee)
            </option>
        `).join('');
}

// Select payment method
function selectPaymentMethod(methodId) {
    AppState.selectedMethod = methodId;
    DOM.metodeSelect.value = methodId;
    renderPaymentMethods(AppState.paymentMethods);
    updateFeeDisplay();
}

// Create transaction
async function createTransaction(e) {
    e.preventDefault();
    
    const nominal = parseInt(DOM.nominalInput.value);
    const metode = DOM.metodeSelect.value;
    
    if (!nominal || !metode) {
        showNotification('Harap isi semua field dengan benar', 'error');
        return;
    }
    
    const method = AppState.paymentMethods.find(m => m.metode === metode);
    if (!method) {
        showNotification('Metode pembayaran tidak valid', 'error');
        return;
    }
    
    if (nominal < parseInt(method.min) || nominal > parseInt(method.max)) {
        showNotification(`Nominal harus antara ${formatCurrency(method.min)} dan ${formatCurrency(method.max)}`, 'error');
        return;
    }
    
    try {
        DOM.createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat Transaksi...';
        DOM.createBtn.disabled = true;
        
        const transaction = await API.createDeposit(nominal, metode);
        AppState.currentTransaction = transaction;
        
        // Simpan ke localStorage
        AppState.transactions.unshift({
            id: transaction.id,
            nominal: transaction.nominal,
            metode: method.name,
            status: transaction.status,
            created_at: transaction.created_at,
            get_balance: transaction.get_balance
        });
        
        localStorage.setItem('transactions', JSON.stringify(AppState.transactions));
        
        renderTransactionDetails(transaction);
        startPollingStatus(transaction.id);
        
        showNotification('Transaksi berhasil dibuat!');
        
        // Reset form
        DOM.paymentForm.reset();
        updateFeeDisplay();
        renderRecentTransactions();
    } catch (error) {
        showNotification(`Gagal membuat transaksi: ${error.message}`, 'error');
    } finally {
        DOM.createBtn.innerHTML = '<i class="fas fa-bolt"></i> Buat Pembayaran';
        DOM.createBtn.disabled = false;
    }
}

// Render transaction details
function renderTransactionDetails(transaction) {
    const { fee, netAmount } = calculateFees(transaction.nominal, AppState.selectedMethod);
    
    // Update badge
    DOM.transactionStatusBadge.textContent = transaction.status;
    DOM.transactionStatusBadge.className = `card-badge ${transaction.status}`;
    
    // Render details
    DOM.transactionDetails.innerHTML = `
        <div class="info-item">
            <span class="info-label">ID Transaksi</span>
            <span class="info-value">${transaction.id}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Ref ID</span>
            <span class="info-value">${transaction.reff_id}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Nominal</span>
            <span class="info-value">${formatCurrency(transaction.nominal)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Biaya</span>
            <span class="info-value">${formatCurrency(fee)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Diterima</span>
            <span class="info-value success">${formatCurrency(netAmount)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value ${transaction.status}">${transaction.status.toUpperCase()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Dibuat</span>
            <span class="info-value">${transaction.created_at}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Kadaluarsa</span>
            <span class="info-value">${transaction.expired_at}</span>
        </div>
    `;
    
    // Show QR code if available
    if (transaction.qr_image) {
        DOM.qrContainer.innerHTML = `
            <div class="qr-code">
                <img src="${transaction.qr_image}" alt="QR Code">
            </div>
            <div class="qr-info">
                <p>Scan QR Code di atas untuk membayar</p>
                <p class="expiry">Kadaluarsa: ${transaction.expired_at}</p>
            </div>
        `;
        DOM.qrContainer.classList.add('active');
    }
    
    // Show transaction actions
    DOM.transactionActions.innerHTML = `
        <button class="btn btn-success" onclick="checkTransactionStatus()">
            <i class="fas fa-sync-alt"></i> Cek Status
        </button>
        <button class="btn btn-danger" onclick="cancelTransaction()">
            <i class="fas fa-times"></i> Batalkan
        </button>
    `;
    DOM.transactionActions.classList.add('active');
    
    // Show transaction info
    DOM.transactionInfo.classList.add('active');
}

// Start polling status
function startPollingStatus(transactionId) {
    if (AppState.pollingInterval) {
        clearInterval(AppState.pollingInterval);
    }
    
    AppState.pollingInterval = setInterval(async () => {
        try {
            const status = await API.checkDepositStatus(transactionId);
            
            if (status.status !== 'pending') {
                clearInterval(AppState.pollingInterval);
                AppState.pollingInterval = null;
                
                // Update transaction in list
                const index = AppState.transactions.findIndex(t => t.id === transactionId);
                if (index !== -1) {
                    AppState.transactions[index].status = status.status;
                    localStorage.setItem('transactions', JSON.stringify(AppState.transactions));
                    renderRecentTransactions();
                }
                
                // Update current transaction
                if (AppState.currentTransaction && AppState.currentTransaction.id === transactionId) {
                    AppState.currentTransaction.status = status.status;
                    renderTransactionDetails(AppState.currentTransaction);
                    
                    if (status.status === 'success') {
                        showNotification('Pembayaran berhasil!', 'success');
                    } else if (status.status === 'cancel') {
                        showNotification('Transaksi dibatalkan', 'error');
                    }
                }
            }
        } catch (error) {
            console.error('Error polling status:', error);
        }
    }, 5000); // Poll every 5 seconds
}

// Check transaction status manually
async function checkTransactionStatus() {
    if (!AppState.currentTransaction) return;
    
    try {
        const status = await API.checkDepositStatus(AppState.currentTransaction.id);
        
        // Show in modal
        DOM.statusResult.innerHTML = `
            <div class="info-item">
                <span class="info-label">Status</span>
                <span class="info-value ${status.status}">${status.status.toUpperCase()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Terakhir Diperbarui</span>
                <span class="info-value">${new Date().toLocaleString()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Metode</span>
                <span class="info-value">${status.metode}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Diterima</span>
                <span class="info-value success">${formatCurrency(status.get_balance)}</span>
            </div>
        `;
        
        DOM.statusModal.classList.add('active');
        
        // Update current transaction
        AppState.currentTransaction.status = status.status;
        renderTransactionDetails(AppState.currentTransaction);
        
    } catch (error) {
        showNotification(`Gagal mengecek status: ${error.message}`, 'error');
    }
}

// Cancel transaction
async function cancelTransaction() {
    if (!AppState.currentTransaction || !confirm('Apakah Anda yakin ingin membatalkan transaksi ini?')) {
        return;
    }
    
    try {
        const result = await API.cancelDeposit(AppState.currentTransaction.id);
        
        // Update transaction
        AppState.currentTransaction.status = result.status;
        renderTransactionDetails(AppState.currentTransaction);
        
        // Update in list
        const index = AppState.transactions.findIndex(t => t.id === AppState.currentTransaction.id);
        if (index !== -1) {
            AppState.transactions[index].status = result.status;
            localStorage.setItem('transactions', JSON.stringify(AppState.transactions));
            renderRecentTransactions();
        }
        
        // Stop polling
        if (AppState.pollingInterval) {
            clearInterval(AppState.pollingInterval);
            AppState.pollingInterval = null;
        }
        
        showNotification('Transaksi berhasil dibatalkan');
        
    } catch (error) {
        showNotification(`Gagal membatalkan transaksi: ${error.message}`, 'error');
    }
}

// Render recent transactions
function renderRecentTransactions() {
    if (AppState.transactions.length === 0) {
        DOM.transactionsList.innerHTML = `
            <div class="empty-state small">
                <div class="empty-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <p>Belum ada transaksi</p>
            </div>
        `;
        return;
    }
    
    // Limit to 5 most recent transactions
    const recentTransactions = AppState.transactions.slice(0, 5);
    
    DOM.transactionsList.innerHTML = recentTransactions.map(transaction => `
        <div class="transaction-item" onclick="viewTransaction('${transaction.id}')">
            <div class="transaction-meta">
                <div class="transaction-id">${transaction.id.substring(0, 12)}...</div>
                <div class="transaction-date">${transaction.created_at}</div>
            </div>
            <div class="transaction-details">
                <div class="transaction-amount">${formatCurrency(transaction.get_balance)}</div>
                <div class="transaction-status ${transaction.status}">${transaction.status.toUpperCase()}</div>
            </div>
        </div>
    `).join('');
}

// View transaction details
function viewTransaction(transactionId) {
    // In a real app, you would fetch the full transaction details
    // For now, we'll just show a notification
    const transaction = AppState.transactions.find(t => t.id === transactionId);
    if (transaction) {
        showNotification(`Melihat transaksi ${transactionId} (${transaction.status})`);
    }
}

// Initialize application
function initApp() {
    // Load payment methods
    loadPaymentMethods();
    
    // Render recent transactions
    renderRecentTransactions();
    
    // Event listeners
    DOM.paymentForm.addEventListener('submit', createTransaction);
    DOM.nominalInput.addEventListener('input', updateFeeDisplay);
    DOM.metodeSelect.addEventListener('change', updateFeeDisplay);
    
    DOM.closeStatus.addEventListener('click', () => {
        DOM.statusBar.style.display = 'none';
    });
    
    DOM.refreshBtn.addEventListener('click', () => {
        loadPaymentMethods();
        showNotification('Aplikasi direfresh');
    });
    
    DOM.refreshTransactions.addEventListener('click', () => {
        renderRecentTransactions();
        showNotification('Daftar transaksi diperbarui');
    });
    
    DOM.closeModal.addEventListener('click', () => {
        DOM.statusModal.classList.remove('active');
    });
    
    // Close modal when clicking outside
    DOM.statusModal.addEventListener('click', (e) => {
        if (e.target === DOM.statusModal) {
            DOM.statusModal.classList.remove('active');
        }
    });
    
    // Initialize fee display
    updateFeeDisplay();
    
    // Show welcome notification
    setTimeout(() => {
        showNotification('Selamat datang di PAYMENT GATEWAY!');
    }, 1000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);