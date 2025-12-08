// Konfigurasi API
const API_CONFIG = {
    BASE_URL: 'https://khafatopup.my.id/h2h',
    API_KEY: 'KhafaTopUp_tabv4nukyceqsxb2', // Ganti dengan API key Anda yang sebenarnya
    ADMIN_FEE: 0.02 // 2% fee admin
};

// Helper untuk membuat header
function getHeaders() {
    return {
        'X-APIKEY': API_CONFIG.API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
}

// Helper untuk build URL dengan CORS proxy jika perlu
function buildUrl(endpoint, params = null) {
    let url = `${API_CONFIG.BASE_URL}/${endpoint}`;
    
    // Jika ada masalah CORS, gunakan proxy
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('vercel.app')) {
        url = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }
    
    if (params) {
        const queryString = new URLSearchParams(params).toString();
        url += `?${queryString}`;
    }
    
    return url;
}

// Fungsi untuk menghitung biaya
function calculateFee(amount) {
    const nominal = parseInt(amount);
    const fee = Math.round(nominal * API_CONFIG.ADMIN_FEE);
    const total = nominal + fee;
    const received = nominal; // Karena fee dari sistem PPOB
    return { nominal, fee, total, received };
}

// Fungsi untuk membuat deposit
async function createDeposit(amount, method = 'QRISFAST') {
    try {
        const params = {
            nominal: parseInt(amount),
            metode: method
        };
        
        const url = buildUrl('deposit/create', params);
        
        console.log('Creating deposit:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
            mode: 'cors',
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                data: {
                    id: data.data.id,
                    reff_id: data.data.reff_id,
                    nominal: data.data.nominal,
                    fee: data.data.fee,
                    get_balance: data.data.get_balance,
                    qr_string: data.data.qr_string,
                    qr_image: data.data.qr_image || `${API_CONFIG.BASE_URL}/qr/${data.data.id}`,
                    status: data.data.status,
                    created_at: data.data.created_at,
                    expired_at: data.data.expired_at
                }
            };
        } else {
            throw new Error(data.message || 'Gagal membuat deposit');
        }
    } catch (error) {
        console.error('Error creating deposit:', error);
        return {
            success: false,
            message: error.message || 'Gagal membuat deposit'
        };
    }
}

// Fungsi untuk mengecek status deposit
async function checkDepositStatus(depositId) {
    try {
        const params = { id: depositId };
        const url = buildUrl('deposit/status', params);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                data: {
                    id: data.data.id,
                    reff_id: data.data.reff_id,
                    nominal: data.data.nominal,
                    fee: data.data.fee,
                    get_balance: data.data.get_balance,
                    metode: data.data.metode,
                    status: data.data.status,
                    created_at: data.data.created_at
                }
            };
        } else {
            throw new Error(data.message || 'Gagal memeriksa status deposit');
        }
    } catch (error) {
        console.error('Error checking deposit status:', error);
        return {
            success: false,
            message: error.message || 'Gagal memeriksa status deposit'
        };
    }
}

// Fungsi untuk membatalkan deposit
async function cancelDeposit(depositId) {
    try {
        const params = { id: depositId };
        const url = buildUrl('deposit/cancel', params);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                data: {
                    id: data.data.id,
                    status: data.data.status,
                    created_at: data.data.created_at
                }
            };
        } else {
            throw new Error(data.message || 'Gagal membatalkan deposit');
        }
    } catch (error) {
        console.error('Error canceling deposit:', error);
        return {
            success: false,
            message: error.message || 'Gagal membatalkan deposit'
        };
    }
}

// Fungsi untuk mendapatkan profile/saldo (simulasi)
async function getUserBalance() {
    try {
        // Simulasi saldo - dalam implementasi asli, ini akan panggil API
        return {
            success: true,
            data: {
                username: 'User',
                saldo: 0,
                fullname: 'User',
                role: 'user'
            }
        };
    } catch (error) {
        console.error('Error getting user balance:', error);
        return {
            success: false,
            message: error.message || 'Gagal mengambil saldo'
        };
    }
}

// Export semua fungsi
window.API = {
    createDeposit,
    checkDepositStatus,
    cancelDeposit,
    calculateFee,
    getUserBalance,
    API_CONFIG
};
