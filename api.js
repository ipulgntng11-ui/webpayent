// Konfigurasi API
const API_CONFIG = {
    BASE_URL: 'https://khafatopup.my.id',
    API_KEY: 'your_api_key_here', // Ganti dengan API key Anda
    ENDPOINTS: {
        GET_METHODS: '/deposit/metode',
        CREATE_DEPOSIT: '/h2h/deposit/create',
        CHECK_STATUS: '/h2h/deposit/status',
        CANCEL_DEPOSIT: '/h2h/deposit/cancel'
    }
};

// Helper untuk membuat header
function getHeaders() {
    return {
        'X-APIKEY': API_CONFIG.API_KEY,
        'Content-Type': 'application/json'
    };
}

// Fungsi untuk mengambil metode pembayaran
async function fetchPaymentMethods() {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_METHODS}`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            // Filter hanya metode QRIS
            const qrisMethods = data.metode.filter(method => 
                method.type === 'ewallet' && method.metode.includes('QRIS')
            );
            return qrisMethods;
        } else {
            throw new Error(data.message || 'Gagal mengambil metode pembayaran');
        }
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        throw error;
    }
}

// Fungsi untuk membuat deposit
async function createDeposit(nominal, metode) {
    try {
        const params = new URLSearchParams({
            nominal: nominal.toString(),
            metode: metode
        });

        const response = await fetch(
            `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CREATE_DEPOSIT}?${params}`, {
                method: 'GET',
                headers: getHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            throw new Error(data.message || 'Gagal membuat deposit');
        }
    } catch (error) {
        console.error('Error creating deposit:', error);
        throw error;
    }
}

// Fungsi untuk mengecek status deposit
async function checkDepositStatus(depositId) {
    try {
        const params = new URLSearchParams({
            id: depositId
        });

        const response = await fetch(
            `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHECK_STATUS}?${params}`, {
                method: 'GET',
                headers: getHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            throw new Error(data.message || 'Gagal mengecek status deposit');
        }
    } catch (error) {
        console.error('Error checking deposit status:', error);
        throw error;
    }
}

// Fungsi untuk membatalkan deposit
async function cancelDeposit(depositId) {
    try {
        const params = new URLSearchParams({
            id: depositId
        });

        const response = await fetch(
            `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CANCEL_DEPOSIT}?${params}`, {
                method: 'GET',
                headers: getHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            throw new Error(data.message || 'Gagal membatalkan deposit');
        }
    } catch (error) {
        console.error('Error canceling deposit:', error);
        throw error;
    }
}

// Export fungsi
window.API = {
    fetchPaymentMethods,
    createDeposit,
    checkDepositStatus,
    cancelDeposit
};