import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MoreVertical, Shield, ShieldOff, Ban, Trash2, Edit, User as UserIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminApi } from '@/api/admin'
import type { AdminUser } from '@/types'
import AdminUserEditModal from './AdminUserEditModal'

export default function AdminUsersPanel() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminApi.getUsers({ page, page_size: 10, search: search || undefined }),
  })

  const banMutation = useMutation({
    mutationFn: ({ userId, isBanned }: { userId: string; isBanned: boolean }) =>
      adminApi.banUser(userId, isBanned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowDeleteConfirm(null)
    },
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email or username..."
            className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-lg transition-colors"
        >
          Search
        </button>
      </form>

      {isLoading ? (
        <div className="text-center py-8 text-dark-400">Loading users...</div>
      ) : (
        <>
          <div className="bg-dark-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Spaces</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-dark-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => (
                  <tr key={user.id} className="border-b border-dark-600 last:border-b-0 hover:bg-dark-600/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-dark-500 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-dark-300" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-dark-100">{user.username}</span>
                            {user.is_admin && (
                              <span className="px-1.5 py-0.5 bg-primary-600/20 text-primary-400 text-xs rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-dark-400">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-dark-300">{user.space_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_banned ? (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                          Banned
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-dark-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-1.5 hover:bg-dark-500 rounded transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-dark-400" />
                        </button>
                        <AnimatePresence>
                          {openMenuId === user.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 mt-1 w-48 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  setSelectedUser(user)
                                  setShowEditModal(true)
                                  setOpenMenuId(null)
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-dark-200 hover:bg-dark-700 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                                Edit User
                              </button>
                              {!user.is_admin && (
                                <>
                                  <button
                                    onClick={() => {
                                      banMutation.mutate({ userId: user.id, isBanned: !user.is_banned })
                                      setOpenMenuId(null)
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-dark-200 hover:bg-dark-700 transition-colors"
                                  >
                                    {user.is_banned ? (
                                      <>
                                        <ShieldOff className="w-4 h-4" />
                                        Unban User
                                      </>
                                    ) : (
                                      <>
                                        <Ban className="w-4 h-4" />
                                        Ban User
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowDeleteConfirm(user.id)
                                      setOpenMenuId(null)
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-dark-700 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete User
                                  </button>
                                </>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark-400">
                Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data?.total || 0)} of {data?.total} users
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 hover:bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-dark-400" />
                </button>
                <span className="text-sm text-dark-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 hover:bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-dark-400" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-800 border border-dark-700 rounded-xl p-6 max-w-md mx-4"
            >
              <h3 className="text-lg font-medium text-dark-100 mb-2">Delete User</h3>
              <p className="text-dark-400 text-sm mb-4">
                Are you sure you want to delete this user? This will permanently remove all their data including spaces, cards, and comments.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showEditModal && selectedUser && (
        <AdminUserEditModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false)
            setSelectedUser(null)
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] })
            setShowEditModal(false)
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}
