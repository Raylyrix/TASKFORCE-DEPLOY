'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { authApi } from '@/lib/api'
import { useWalletStore } from '@/lib/store'
import Layout from '@/components/Layout'
import { Settings as SettingsIcon, User, LogOut } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { user, setUser, setToken } = useWalletStore()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const handleLogout = async () => {
    await authApi.logout()
    setUser(null)
    setToken(null)
    router.push('/login')
  }

  if (!user) {
    return null
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Manage your account</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.name || 'User'}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </Layout>
  )
}

