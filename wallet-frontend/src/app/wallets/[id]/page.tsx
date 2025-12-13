'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { walletsApi, paymentsApi } from '@/lib/api'
import { useWalletStore } from '@/lib/store'
import Layout from '@/components/Layout'
import { ArrowLeft, Send, RefreshCw, Copy, Check, ExternalLink, History } from 'lucide-react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'

export default function WalletDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const walletId = params.id as string
  const { user } = useWalletStore()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', walletId],
    queryFn: () => walletsApi.get(walletId),
    enabled: !!user && !!walletId,
  })

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['wallet-balance', walletId],
    queryFn: () => walletsApi.getBalance(walletId),
    enabled: !!user && !!walletId,
  })

  const { data: payments } = useQuery({
    queryKey: ['wallet-payments', walletId],
    queryFn: () => paymentsApi.list(),
    enabled: !!user && !!walletId,
  })

  const copyAddress = () => {
    if (wallet?.data?.address) {
      navigator.clipboard.writeText(wallet.data.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getExplorerUrl = (chain: string, address: string) => {
    switch (chain) {
      case 'ethereum':
        return `https://etherscan.io/address/${address}`
      case 'polygon':
        return `https://polygonscan.com/address/${address}`
      case 'arbitrum':
        return `https://arbiscan.io/address/${address}`
      case 'solana':
        return `https://solscan.io/account/${address}`
      case 'bitcoin':
        return `https://blockstream.info/address/${address}`
      default:
        return null
    }
  }

  if (!user) {
    return null
  }

  if (walletLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  if (!wallet?.data) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Wallet not found</h2>
            <Link href="/dashboard" className="text-primary-600 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const walletData = wallet.data
  const explorerUrl = getExplorerUrl(walletData.chain, walletData.address)
  const chainIcons: Record<string, string> = {
    ethereum: '🔷',
    solana: '🟣',
    bitcoin: '🟠',
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Wallet Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{chainIcons[walletData.chain] || '💼'}</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {walletData.chain.charAt(0).toUpperCase() + walletData.chain.slice(1)} Wallet
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-sm text-gray-500 font-mono">{walletData.address}</p>
                  <button
                    onClick={copyAddress}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="View on explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                walletsApi.refreshBalance(walletId).then(() => {
                  // Refetch queries
                })
              }}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh Balance"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Balance */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-1">Total Balance</p>
            {balanceLoading ? (
              <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              <p className="text-3xl font-bold text-gray-900">
                {balance?.data?.reduce((sum: number, b: any) => {
                  return sum + parseFloat(b.balance || '0')
                }, 0).toFixed(6) || '0.000000'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={`/send?wallet=${walletId}`}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Send className="w-5 h-5" />
              <span>Send</span>
            </Link>
          </div>
        </div>

        {/* QR Code for Receiving */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Receive</h2>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <QRCodeSVG value={walletData.address} size={200} />
            </div>
            <p className="text-sm text-gray-600 text-center font-mono break-all">
              {walletData.address}
            </p>
            <button
              onClick={copyAddress}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Balances */}
        {balance?.data && balance.data.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Token Balances</h2>
            <div className="space-y-3">
              {balance.data.map((b: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{b.tokenSymbol || 'Native'}</p>
                    {b.tokenAddress && (
                      <p className="text-xs text-gray-500 font-mono truncate max-w-[200px]">
                        {b.tokenAddress}
                      </p>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {parseFloat(b.balance || '0').toFixed(6)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Payments */}
        {payments?.data && payments.data.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
              <Link
                href="/payments"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {payments.data
                .filter((p: any) => p.walletId === walletId)
                .slice(0, 5)
                .map((payment: any) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {payment.merchant?.businessName || 'Payment'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {payment.amount} {payment.currency}
                      </p>
                      <p
                        className={`text-xs ${
                          payment.status === 'COMPLETED'
                            ? 'text-green-600'
                            : payment.status === 'FAILED'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {payment.status}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

