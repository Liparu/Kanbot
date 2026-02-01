import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { adminApi } from '@/api/admin'
import type { AdminUser } from '@/types'

interface Props {
  user: AdminUser
  onClose: () => void
  onSave: () => void
}

export default function AdminUserEditModal({ user, onClose, onSave }: Props) {
  const [email, setEmail] = useState(user.email)
  const [username, setUsername] = useState(user.username)
  const [isAdmin, setIsAdmin] = useState(user.is_admin)
  const [error, setError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.updateUser(user.id, {
        email: email !== user.email ? email : undefined,
        username: username !== user.username ? username : undefined,
        is_admin: isAdmin !== user.is_admin ? isAdmin : undefined,
      }),
    onSuccess: () => {
      onSave()
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Failed to update user')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    updateMutation.mutate()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-dark-100">Edit User</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dark-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-dark-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-dark-200">Administrator privileges</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
