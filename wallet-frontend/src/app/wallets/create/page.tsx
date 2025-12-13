'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { walletsApi } from '@/lib/api'
import Layout from '@/components/Layout'
import { ArrowLeft, Wallet } from 'lucide-react'
import Link from 'next/link'

export default function CreateWalletPage() {
  const router = useRouter()
  const [chain, setChain] = useState<'ethereum' | 'solana' | 'bitcoin'>('ethereum')

  const createMutation = useMutation({
    mutationFn: (data: { chain: 'ethereum' | 'solana' | 'bitcoin' }) => walletsApi.create(data),
    onSuccess: () => {
      router.push('/dashboard')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({ chain })
  }

  const chains = [
    { value: 'ethereum', label: 'Ethereum', icon: '🔷', desc: 'ETH and ERC-20 tokens' },
    { value: 'solana', label: 'Solana', icon: '🟣', desc: 'SOL and SPL tokens' },
    { value: 'bitcoin', label: 'Bitcoin', icon: '🟠', desc: 'BTC only' },
  ]

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
              <Wallet className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Wallet</h1>
              <p className="text-gray-600">Choose a blockchain network</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {chains.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChain(c.value as any)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    chain === c.value
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <div className="font-semibold text-gray-900">{c.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{c.desc}</div>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Wallet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

