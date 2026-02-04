import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Plus, Trash2, Copy, Check, Shield, Users, BarChart3, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore, DATE_FORMAT_OPTIONS } from '@/stores/settings'
import { authApi } from '@/api/auth'
import type { APIKey } from '@/types'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel'
import AdminStatsPanel from '@/components/admin/AdminStatsPanel'

type AdminTab = 'users' | 'stats'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user, updateUser } = useAuthStore()
  const { dateFormat, setDateFormat } = useSettingsStore()
  
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCreatedKey, setShowCreatedKey] = useState(false)
  const [adminTab, setAdminTab] = useState<AdminTab>('users')
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const { data: apiKeys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: authApi.listApiKeys,
  })

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => authApi.createApiKey(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setCreatedKey(data.key)
      setShowCreateKey(false)
      setNewKeyName('')
      setShowCreatedKey(false)
    },
    onError: (error: any) => {
      console.error('Failed to create API key:', error)
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: authApi.deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    },
    onError: (error: any) => {
      setPasswordError(error.response?.data?.detail || 'Failed to change password')
    },
  })

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (newKeyName.trim()) {
      createKeyMutation.mutate(newKeyName)
    }
  }

  const handleCopyKey = async () => {
    if (!createdKey) return

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(createdKey)
      } else {
        // Fallback for non-secure contexts or older browsers
        const textArea = document.createElement('textarea')
        textArea.value = createdKey
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        try {
          const successful = document.execCommand('copy')
          if (!successful) {
            throw new Error('execCommand copy failed')
          }
        } finally {
          textArea.remove()
        }
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy API key:', error)
      // Could add toast notification here in the future
    }
  }

  const handleDismissCreatedKey = () => {
    setCreatedKey(null)
    setShowCreatedKey(false)
  }

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
    updateUser({ language: lang })
  }

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    
    changePasswordMutation.mutate()
  }

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••'
    return `${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}`
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t('settings.title')}</h1>

      <div className="space-y-6">
        <section className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h2 className="text-lg font-medium text-dark-100 mb-4">{t('settings.profile')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">{t('auth.username')}</label>
              <p className="text-dark-100">{user?.username}</p>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">{t('auth.email')}</label>
              <p className="text-dark-100">{user?.email}</p>
            </div>
          </div>
        </section>

        <section className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-dark-400" />
            <h2 className="text-lg font-medium text-dark-100">Change Password</h2>
          </div>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-dark-400 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-dark-500 mt-1">Minimum 6 characters</p>
            </div>
            
            <div>
              <label className="block text-sm text-dark-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                required
              />
            </div>
            
            <AnimatePresence>
              {passwordError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {passwordError}
                </motion.div>
              )}
              
              {passwordSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm"
                >
                  <Check className="w-4 h-4 flex-shrink-0" />
                  Password changed successfully
                </motion.div>
              )}
            </AnimatePresence>
            
            <button
              type="submit"
              disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </section>

        <section className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h2 className="text-lg font-medium text-dark-100 mb-4">{t('settings.language')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                i18n.language === 'en'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              English
            </button>
            <button
              onClick={() => handleLanguageChange('cs')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                i18n.language === 'cs'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              Čeština
            </button>
          </div>
        </section>

        <section className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h2 className="text-lg font-medium text-dark-100 mb-4">{t('settings.dateFormat')}</h2>
          <div className="flex flex-wrap gap-2">
            {DATE_FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDateFormat(option.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  dateFormat === option.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-xs ml-2 opacity-70">({option.example})</span>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-dark-400" />
              <h2 className="text-lg font-medium text-dark-100">{t('settings.apiKeys')}</h2>
            </div>
            <button
              onClick={() => setShowCreateKey(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Key
            </button>
          </div>

          <p className="text-sm text-dark-400 mb-4">
            API keys allow external applications to access your Kanbot data. Keep them secure and never share them publicly.
          </p>

          <AnimatePresence>
            {createdKey && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg"
              >
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">Save your API key now</p>
                    <p className="text-xs text-amber-400/80 mt-1">
                      This key will only be shown once. Copy and store it securely.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-dark-700 rounded font-mono text-sm overflow-x-auto">
                    {showCreatedKey ? (
                      <span className="text-dark-100">{createdKey}</span>
                    ) : (
                      <span className="text-dark-400">{maskKey(createdKey)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCreatedKey(!showCreatedKey)}
                    className="p-2 bg-dark-700 hover:bg-dark-600 rounded transition-colors"
                    title={showCreatedKey ? 'Hide key' : 'Show key'}
                  >
                    {showCreatedKey ? (
                      <EyeOff className="w-4 h-4 text-dark-300" />
                    ) : (
                      <Eye className="w-4 h-4 text-dark-300" />
                    )}
                  </button>
                  <button
                    onClick={handleCopyKey}
                    className="p-2 bg-dark-700 hover:bg-dark-600 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-dark-300" />
                    )}
                  </button>
                </div>
                <button
                  onClick={handleDismissCreatedKey}
                  className="mt-3 text-xs text-dark-400 hover:text-dark-300 transition-colors"
                >
                  I've saved this key, dismiss this message
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCreateKey && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowCreateKey(false)}
              >
                <motion.form
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleCreateKey}
                  className="bg-dark-800 border border-dark-700 rounded-xl p-6 max-w-md w-full mx-4"
                >
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Create API Key</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm text-dark-400 mb-2">Key Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., My Integration, Automation Bot"
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                      autoFocus
                      required
                    />
                    <p className="text-xs text-dark-500 mt-2">
                      Give your key a descriptive name so you can identify it later.
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateKey(false)}
                      className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 text-sm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newKeyName.trim() || createKeyMutation.isPending}
                      className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                    >
                      {createKeyMutation.isPending ? 'Creating...' : 'Generate Key'}
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {apiKeys.map((key: APIKey) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-dark-400" />
                  <div>
                    <p className="text-sm text-dark-100">{key.name}</p>
                    <p className="text-xs text-dark-500">
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used && ` • Last used ${new Date(key.last_used).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteKeyMutation.mutate(key.id)}
                  className="p-2 text-dark-400 hover:text-red-400 rounded hover:bg-dark-600 transition-colors"
                  title="Delete key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {apiKeys.length === 0 && !createdKey && (
              <p className="text-center text-dark-500 py-4">No API keys yet</p>
            )}
          </div>
        </section>

        {user?.is_admin && (
          <section className="bg-dark-800 rounded-xl p-6 border border-dark-700">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-medium text-dark-100">Admin Panel</h2>
            </div>

            <div className="flex gap-2 mb-4 border-b border-dark-600 pb-4">
              <button
                onClick={() => setAdminTab('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  adminTab === 'users'
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
              >
                <Users className="w-4 h-4" />
                Users
              </button>
              <button
                onClick={() => setAdminTab('stats')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  adminTab === 'stats'
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Statistics
              </button>
            </div>

            {adminTab === 'users' && <AdminUsersPanel />}
            {adminTab === 'stats' && <AdminStatsPanel />}
          </section>
        )}
      </div>
    </div>
  )
}
