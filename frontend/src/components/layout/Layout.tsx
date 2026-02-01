import { useMemo, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Calendar,
  Settings,
  LogOut,
  Plus,
  Building2,
  User,
  Bell,
  Menu,
  X,
  Bot,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useSpaceStore } from '@/stores/spaces'
import { spacesApi } from '@/api/spaces'
import { notificationsApi } from '@/api/notifications'
import { useNotificationStore } from '@/stores/notifications'
import NotificationPanel from '@/components/notifications/NotificationPanel'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { spaces, setSpaces, setCurrentSpace } = useSpaceStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { notifications, unreadCount, setNotifications, markRead, markAllRead, removeNotification } =
    useNotificationStore()
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceType, setNewSpaceType] = useState<'personal' | 'company' | 'agent'>('personal')

  useQuery({
    queryKey: ['spaces'],
    queryFn: async () => {
      const data = await spacesApi.list()
      setSpaces(data)
      return data
    },
  })

  const { isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await notificationsApi.list()
      setNotifications(data)
      const hasUnreadSpaceInvite = data.some(
        (n: any) => n.type === 'space_invite' && !n.read
      )
      if (hasUnreadSpaceInvite) {
        queryClient.invalidateQueries({ queryKey: ['spaces'] })
      }
      return data
    },
    enabled: !!user,
    refetchInterval: 30000,
  })

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (notification) => {
      markRead(notification.id)
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      markAllRead()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: notificationsApi.remove,
    onSuccess: (_data, notificationId) => {
      removeNotification(notificationId)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const personalSpaces = spaces.filter((s) => s.type === 'personal')
  const companySpaces = spaces.filter((s) => s.type === 'company')
  const agentSpaces = spaces.filter((s) => s.type === 'agent')
  const unreadBadge = useMemo(() => (unreadCount > 99 ? '99+' : unreadCount.toString()), [unreadCount])

  const createSpaceMutation = useMutation({
    mutationFn: (data: { name: string; type: 'personal' | 'company' | 'agent' }) => spacesApi.create(data),
    onSuccess: (newSpace) => {
      setSpaces([...spaces, newSpace])
      queryClient.invalidateQueries({ queryKey: ['spaces'] })
      setNewSpaceName('')
      setNewSpaceType('personal')
      setShowCreateSpaceModal(false)
      setCurrentSpace(newSpace.id)
      navigate(`/spaces/${newSpace.id}`)
    },
  })

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSpaceName.trim()) return
    createSpaceMutation.mutate({ name: newSpaceName.trim(), type: newSpaceType })
  }

  return (
    <div className="flex h-screen bg-dark-900">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-dark-950 border-r border-dark-700 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-dark-700">
              <h1 className="text-xl font-bold text-primary-400">Kanbot</h1>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              <div className="mb-4">
                <Link
                  to="/spaces"
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname === '/spaces'
                      ? 'bg-dark-800 text-dark-100'
                      : 'text-dark-300 hover:text-dark-100 hover:bg-dark-800'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {t('spaces.title')}
                </Link>

                <div className="mt-1 ml-2">
                  {personalSpaces.length > 0 && (
                    <div className="mb-2">
                      <p className="px-3 py-1 text-xs font-medium text-dark-500 uppercase">
                        <User className="w-3 h-3 inline mr-1" />
                        {t('spaces.personal')}
                      </p>
                      {personalSpaces.map((space) => (
                        <Link
                          key={space.id}
                          to={`/spaces/${space.id}`}
                          onClick={() => setCurrentSpace(space.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            location.pathname === `/spaces/${space.id}`
                              ? 'bg-primary-600 text-white'
                              : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                          }`}
                        >
                          {space.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  {companySpaces.length > 0 && (
                    <div className="mb-2">
                      <p className="px-3 py-1 text-xs font-medium text-dark-500 uppercase">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {t('spaces.company')}
                      </p>
                      {companySpaces.map((space) => (
                        <Link
                          key={space.id}
                          to={`/spaces/${space.id}`}
                          onClick={() => setCurrentSpace(space.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            location.pathname === `/spaces/${space.id}`
                              ? 'bg-primary-600 text-white'
                              : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                          }`}
                        >
                          {space.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  {agentSpaces.length > 0 && (
                    <div className="mb-2">
                      <p className="px-3 py-1 text-xs font-medium text-dark-500 uppercase">
                        <Bot className="w-3 h-3 inline mr-1" />
                        {t('spaces.agent')}
                      </p>
                      {agentSpaces.map((space) => (
                        <Link
                          key={space.id}
                          to={`/spaces/${space.id}`}
                          onClick={() => setCurrentSpace(space.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            location.pathname === `/spaces/${space.id}`
                              ? 'bg-primary-600 text-white'
                              : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                          }`}
                        >
                          {space.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setShowCreateSpaceModal(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800 w-full"
                  >
                    <Plus className="w-4 h-4" />
                    {t('spaces.createSpace')}
                  </button>
                </div>
              </div>

              <Link
                to="/calendar"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  location.pathname === '/calendar'
                    ? 'bg-dark-800 text-dark-100'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {t('calendar.title')}
              </Link>
            </nav>

            <div className="p-2 border-t border-dark-700">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-3 py-2 text-sm text-dark-300 hover:text-dark-100 rounded-lg hover:bg-dark-800"
              >
                <Settings className="w-4 h-4" />
                {t('common.settings')}
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dark-300 hover:text-red-400 rounded-lg hover:bg-dark-800"
              >
                <LogOut className="w-4 h-4" />
                {t('common.logout')}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-dark-950 border-b border-dark-700 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                data-notification-trigger="true"
                className="p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800 relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {unreadBadge}
                  </span>
                )}
              </button>
              <NotificationPanel
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                notifications={notifications}
                onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
                onMarkAllRead={() => markAllReadMutation.mutate()}
                onRemove={(notificationId) => deleteMutation.mutate(notificationId)}
                isLoading={notificationsLoading}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.username?.[0]?.toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-dark-200">{user?.username}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {showCreateSpaceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateSpaceModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700"
          >
            <h2 className="text-xl font-bold text-dark-100 mb-4">
              {t('spaces.createSpace')}
            </h2>
            <form onSubmit={handleCreateSpace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  {t('spaces.spaceName')}
                </label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:border-primary-500"
                  placeholder="My Space"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  {t('spaces.spaceType')}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="spaceType"
                      checked={newSpaceType === 'personal'}
                      onChange={() => setNewSpaceType('personal')}
                      className="text-primary-600"
                    />
                    <span className="text-dark-200">{t('spaces.personal')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="spaceType"
                      checked={newSpaceType === 'company'}
                      onChange={() => setNewSpaceType('company')}
                      className="text-primary-600"
                    />
                    <span className="text-dark-200">{t('spaces.company')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="spaceType"
                      checked={newSpaceType === 'agent'}
                      onChange={() => setNewSpaceType('agent')}
                      className="text-primary-600"
                    />
                    <span className="text-dark-200">{t('spaces.agent')}</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateSpaceModal(false)}
                  className="px-4 py-2 text-dark-300 hover:text-dark-100 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
                >
                  {t('common.create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
