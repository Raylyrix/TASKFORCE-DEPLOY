'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { paymentsApi, walletsApi, exchangeApi } from '@/lib/api'
import { useWalletStore } from '@/lib/store'
import Layout from '@/components/Layout'
import { ArrowLeft, QrCode, Scan, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentsPage() {
  const router = useRouter()
  const { user } = useWalletStore()
  const [merchantQR, setMerchantQR] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [cryptoCurrency, setCryptoCurrency] = useState('ETH')
  const [walletId, setWalletId] = useState('')
  const [error, setError] = useState('')

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list(),
    enabled: !!user,
  })

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => paymentsApi.create(data),
    onSuccess: (data) => {
      // Process payment immediately
      paymentsApi.process(data.payment.id).then(() => {
        router.push('/dashboard')
      })
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Payment failed')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!walletId || !merchantQR || !amount) {
      setError('Please fill all fields')
      return
    }

    createPaymentMutation.mutate({
      walletId,
      merchantId: merchantQR,
      amount: parseFloat(amount),
      currency,
      cryptoCurrency,
    })
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <QrCode className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pay with QR</h1>
              <p className="text-gray-600">Scan merchant QR code and pay</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Merchant QR Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={merchantQR}
                  onChange={(e) => setMerchantQR(e.target.value)}
                  required
                  placeholder="Enter or scan QR code"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Wallet
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Choose a wallet</option>
                {wallets?.wallets?.map((wallet: any) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.chain.toUpperCase()} - {wallet.address.substring(0, 10)}...
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crypto Currency
              </label>
              <select
                value={cryptoCurrency}
                onChange={(e) => setCryptoCurrency(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="ETH">Ethereum (ETH)</option>
                <option value="SOL">Solana (SOL)</option>
                <option value="BTC">Bitcoin (BTC)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={createPaymentMutation.isPending}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPaymentMutation.isPending ? 'Processing...' : 'Pay Now'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

