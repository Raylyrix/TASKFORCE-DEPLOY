'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { merchantsApi, paymentsApi } from '@/lib/api'
import { useWalletStore } from '@/lib/store'
import Layout from '@/components/Layout'
import { Store, QrCode, Copy, Check, AlertCircle, Plus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export default function MerchantPage() {
  const router = useRouter()
  const { user } = useWalletStore()
  const [copied, setCopied] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [upiId, setUpiId] = useState('')

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const { data: merchant, isLoading } = useQuery({
    queryKey: ['merchant'],
    queryFn: () => merchantsApi.get(),
    enabled: !!user,
  })

  const { data: payments } = useQuery({
    queryKey: ['merchant-payments', merchant?.data?.id],
    queryFn: () => merchantsApi.getPayments(merchant?.data?.id || ''),
    enabled: !!user && !!merchant?.data?.id,
  })

  const registerMutation = useMutation({
    mutationFn: (data: any) => merchantsApi.register(data),
    onSuccess: () => {
      setShowRegister(false)
      // Refetch merchant data
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => merchantsApi.update(merchant?.data?.id || '', data),
    onSuccess: () => {
      // Refetch merchant data
    },
  })

  const copyQR = () => {
    if (merchant?.data?.qrCode) {
      navigator.clipboard.writeText(merchant.data.qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    registerMutation.mutate({
      businessName,
      businessType,
    })
  }

  const handleUpdateUPI = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate({ upiId })
  }

  if (!user) {
    return null
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  // Show registration form if not a merchant
  if (!merchant?.data && !showRegister) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
            <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Become a Merchant</h2>
            <p className="text-gray-600 mb-6">
              Register as a merchant to accept crypto payments via QR code
            </p>
            <button
              onClick={() => setShowRegister(true)}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Register as Merchant</span>
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // Registration form
  if (showRegister && !merchant?.data) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Register as Merchant</h1>

            {registerMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>
                  {(registerMutation.error as any)?.response?.data?.error || 'Registration failed'}
                </span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Your business name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Type
                </label>
                <input
                  type="text"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Restaurant, Shop, Service"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {registerMutation.isPending ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    )
  }

  const merchantData = merchant?.data

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Merchant Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your merchant account</p>
          </div>
        </div>

        {/* Merchant Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{merchantData?.businessName}</h2>
              {merchantData?.businessType && (
                <p className="text-sm text-gray-600">{merchantData.businessType}</p>
              )}
            </div>
          </div>

          {/* QR Code */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Payment QR Code</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <QRCodeSVG value={merchantData?.qrCode || ''} size={200} />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2 font-mono">{merchantData?.qrCode}</p>
                <button
                  onClick={copyQR}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors mx-auto"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy QR Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* UPI ID Setup */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">UPI ID Configuration</h3>
            {merchantData?.upiId ? (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">UPI ID</p>
                  <p className="font-mono text-gray-900">{merchantData.upiId}</p>
                </div>
                <button
                  onClick={() => setUpiId(merchantData.upiId || '')}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <form onSubmit={handleUpdateUPI} className="space-y-3">
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@paytm or yourname@ybl"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !upiId}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save UPI ID'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Payment Statistics */}
        {payments?.data && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Received</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{payments.data
                    .filter((p: any) => p.status === 'COMPLETED')
                    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
                    .toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Payments</p>
                <p className="text-2xl font-bold text-blue-600">{payments.data.length}</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {payments.data.filter((p: any) => p.status === 'PENDING').length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Payments */}
        {payments?.data && payments.data.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h2>
            <div className="space-y-3">
              {payments.data.slice(0, 10).map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {payment.user?.displayName || payment.user?.email || 'Customer'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(payment.createdAt).toLocaleString()}
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

