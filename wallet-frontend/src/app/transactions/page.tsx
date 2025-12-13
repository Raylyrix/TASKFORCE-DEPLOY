'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { walletsApi } from '@/lib/api'
import { useWalletStore } from '@/lib/store'
import Layout from '@/components/Layout'
import { ArrowLeft, ExternalLink, Send, ArrowDownRight } from 'lucide-react'
import Link from 'next/link'

export default function TransactionsPage() {
  const router = useRouter()
  const { user } = useWalletStore()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list(),
    enabled: !!user,
  })

  // Get all transactions from all wallets
  const allTransactions: any[] = []
  wallets?.wallets?.forEach((wallet: any) => {
    if (wallet.transactions) {
      wallet.transactions.forEach((tx: any) => {
        allTransactions.push({ ...tx, wallet })
      })
    }
  })

  // Sort by date (newest first)
  allTransactions.sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })

  const getExplorerUrl = (chain: string, txHash: string) => {
    switch (chain) {
      case 'ethereum':
        return `https://etherscan.io/tx/${txHash}`
      case 'polygon':
        return `https://polygonscan.com/tx/${txHash}`
      case 'arbitrum':
        return `https://arbiscan.io/tx/${txHash}`
      case 'solana':
        return `https://solscan.io/tx/${txHash}`
      case 'bitcoin':
        return `https://blockstream.info/tx/${txHash}`
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'COMPLETED':
        return 'text-green-600 bg-green-50'
      case 'FAILED':
      case 'REVERTED':
        return 'text-red-600 bg-red-50'
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (!user) {
    return null
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Transaction History</h1>

          {allTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No transactions yet</p>
              <Link
                href="/send"
                className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
              >
                <Send className="w-5 h-5" />
                <span>Send your first transaction</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {allTransactions.map((tx: any) => {
                const explorerUrl = getExplorerUrl(tx.chain || tx.wallet?.chain, tx.txHash)
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        {tx.fromAddress === tx.wallet?.address ? (
                          <Send className="w-5 h-5 text-primary-600" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {tx.fromAddress === tx.wallet?.address ? 'Sent' : 'Received'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {tx.toAddress?.substring(0, 10)}...{tx.toAddress?.substring(tx.toAddress.length - 8)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {parseFloat(tx.amount || '0').toFixed(6)} {tx.tokenSymbol || 'ETH'}
                        </p>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            tx.status
                          )}`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="View on explorer"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

