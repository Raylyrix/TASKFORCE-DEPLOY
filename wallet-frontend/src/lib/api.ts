import axios from 'axios'

// Railway provides URLs without https://, so we need to add it
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  // If URL doesn't start with http, add https://
  if (url && !url.startsWith('http')) {
    return `https://${url}`
  }
  return url
}

const API_URL = getApiUrl()

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('wallet_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('wallet_token')
      localStorage.removeItem('wallet_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  register: async (data: { email: string; password: string; name?: string }) => {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  },
  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/login', data)
    if (response.data.token) {
      localStorage.setItem('wallet_token', response.data.token)
      localStorage.setItem('wallet_user', JSON.stringify(response.data.user))
    }
    return response.data
  },
  logout: async () => {
    const token = localStorage.getItem('wallet_token')
    if (token) {
      await apiClient.post('/auth/logout', { token })
    }
    localStorage.removeItem('wallet_token')
    localStorage.removeItem('wallet_user')
  },
  getMe: async () => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },
}

// Wallets API
export const walletsApi = {
  list: async () => {
    const response = await apiClient.get('/wallets')
    return response.data
  },
  create: async (data: { chain: 'ethereum' | 'solana' | 'bitcoin' }) => {
    const response = await apiClient.post('/wallets', data)
    return response.data
  },
  get: async (id: string) => {
    const response = await apiClient.get(`/wallets/${id}`)
    return response.data
  },
  getBalance: async (id: string) => {
    const response = await apiClient.get(`/wallets/${id}/balance`)
    return response.data
  },
  refreshBalance: async (id: string) => {
    const response = await apiClient.post(`/wallets/${id}/refresh-balance`)
    return response.data
  },
  send: async (id: string, data: { to: string; amount: string }) => {
    const response = await apiClient.post(`/wallets/${id}/send`, data)
    return response.data
  },
}

// Payments API
export const paymentsApi = {
  getOptions: async () => {
    const response = await apiClient.get('/payments/options')
    return response.data
  },
  create: async (data: {
    walletId: string
    merchantId?: string
    amount: number
    currency: string
    cryptoCurrency: string
  }) => {
    const response = await apiClient.post('/payments', data)
    return response.data
  },
  list: async () => {
    const response = await apiClient.get('/payments')
    return response.data
  },
  get: async (id: string) => {
    const response = await apiClient.get(`/payments/${id}`)
    return response.data
  },
  process: async (id: string) => {
    const response = await apiClient.post(`/payments/${id}/process`)
    return response.data
  },
  refund: async (id: string, reason: string) => {
    const response = await apiClient.post(`/payments/${id}/refund`, { reason })
    return response.data
  },
}

// Merchants API
export const merchantsApi = {
  register: async (data: {
    businessName: string
    businessType: string
    bankAccount?: string
  }) => {
    const response = await apiClient.post('/merchants', data)
    return response.data
  },
  get: async () => {
    const response = await apiClient.get('/merchants')
    return response.data
  },
  getById: async (id: string) => {
    const response = await apiClient.get(`/merchants/${id}`)
    return response.data
  },
  getByQR: async (qrCode: string) => {
    const response = await apiClient.get(`/merchants/qr/${qrCode}`)
    return response.data
  },
  update: async (id: string, data: any) => {
    const response = await apiClient.put(`/merchants/${id}`, data)
    return response.data
  },
  getPayments: async (id: string) => {
    const response = await apiClient.get(`/merchants/${id}/payments`)
    return response.data
  },
}

// Exchange API
export const exchangeApi = {
  getRate: async (from: string, to: string) => {
    const response = await apiClient.get(`/exchange/rates?from=${from}&to=${to}`)
    return response.data
  },
  convert: async (data: { from: string; to: string; amount: number }) => {
    const response = await apiClient.post('/exchange/convert', data)
    return response.data
  },
  getCurrencies: async () => {
    const response = await apiClient.get('/exchange/currencies')
    return response.data
  },
}

