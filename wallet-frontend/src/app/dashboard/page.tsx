'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { walletsApi } from '@/lib/api'
import { useWalletStore } from '@/lib/store'
import Layout from '@/components/Layout'
import { Wallet, Plus, RefreshCw, ArrowUpRight, ArrowDownRight, History } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useWalletStore()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const { data: wallets, isLoading, refetch } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list(),
    enabled: !!user,
  })

  const chainIcons: Record<string, string> = {
    ethereum: '🔷',
    solana: '🟣',
    bitcoin: '🟠',
  }

  const chainNames: Record<string, string> = {
    ethereum: 'Ethereum',
    solana: 'Solana',
    bitcoin: 'Bitcoin',
  }

  if (!user) {
    return null
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your crypto wallets</p>
          </div>
          <Link
            href="/wallets/create"
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Wallet</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : wallets?.wallets?.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No wallets yet</h3>
            <p className="text-gray-600 mb-6">Create your first wallet to get started</p>
            <Link
              href="/wallets/create"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create Wallet</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets?.wallets?.map((wallet: any) => (
              <div
                key={wallet.id}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{chainIcons[wallet.chain] || '💼'}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {chainNames[wallet.chain] || wallet.chain}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono truncate max-w-[200px]">
                        {wallet.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-2xl font-bold text-gray-900">
                    {parseFloat(wallet.balance || '0').toFixed(6)}
                  </p>
                  <p className="text-sm text-gray-500 uppercase">{wallet.chain}</p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/wallets/${wallet.id}`}
                    className="flex-1 text-center py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => {
                      walletsApi.refreshBalance(wallet.id).then(() => refetch())
                    }}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Refresh Balance"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Link
            href="/send"
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Send Crypto</h3>
                <p className="text-sm text-gray-600">Transfer to another wallet</p>
              </div>
            </div>
          </Link>

          <Link
            href="/payments"
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Pay with QR</h3>
                <p className="text-sm text-gray-600">Scan and pay merchants</p>
              </div>
            </div>
          </Link>

          <Link
            href="/transactions"
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <History className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Transactions</h3>
                <p className="text-sm text-gray-600">View transaction history</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  )
}

