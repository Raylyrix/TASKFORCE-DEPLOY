'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { walletsApi } from '@/lib/api'
import { useWalletStore } from '@/lib/store'
import Layout from '@/components/Layout'
import { ArrowLeft, Send, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function SendPage() {
  const router = useRouter()
  const { user } = useWalletStore()
  const [walletId, setWalletId] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list(),
    enabled: !!user,
  })

  const sendMutation = useMutation({
    mutationFn: (data: { to: string; amount: string }) => walletsApi.send(walletId, data),
    onSuccess: () => {
      router.push('/dashboard')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send transaction')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!walletId) {
      setError('Please select a wallet')
      return
    }

    if (!to || !amount) {
      setError('Please fill all fields')
      return
    }

    sendMutation.mutate({ to, amount })
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
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Send Crypto</h1>
              <p className="text-gray-600">Transfer to another wallet address</p>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                placeholder="0x..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <input
                type="number"
                step="0.000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={sendMutation.isPending}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMutation.isPending ? 'Sending...' : 'Send Transaction'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

