import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Trash2, ExternalLink } from 'lucide-react'
import type { Notification } from '@/types'
interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkRead: (notificationId: string) => void
  onMarkAllRead: () => void
  onRemove: (notificationId: string) => void
  onCardClick?: (cardId: string, spaceId?: string) => void
  isLoading?: boolean
}

const formatDate = (value: string) => {
  // Notifications use UTC timestamps — convert to local time naturally
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

const getUnreadCount = (items: Notification[]) =>
  items.reduce((count, item) => count + (item.read ? 0 : 1), 0)

// Extract card_id and space info from notification data
const getCardInfo = (notification: Notification): { cardId?: string; spaceName?: string; spaceId?: string } => {
  const data = notification.data || {}
  return {
    cardId: data.card_id as string | undefined,
    spaceName: data.space_name as string | undefined,
    spaceId: data.space_id as string | undefined,
  }
}

export default function NotificationPanel({
  open,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onRemove,
  onCardClick,
  isLoading,
}: NotificationPanelProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-notification-trigger="true"]')) {
        return
      }
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [open, onClose])

  const handleNotificationClick = (notification: Notification) => {
    const { cardId, spaceId } = getCardInfo(notification)
    if (cardId && onCardClick) {
      onCardClick(cardId, spaceId)
      onClose()
      // Mark as read when clicked
      if (!notification.read) {
        onMarkRead(notification.id)
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
            <div className="text-sm font-medium text-dark-100">{t('notifications.title')}</div>
            <button
              onClick={onMarkAllRead}
              className="text-xs text-primary-400 hover:text-primary-300 disabled:text-dark-500"
              disabled={getUnreadCount(notifications) === 0 || isLoading}
            >
              {t('notifications.markAllRead')}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-dark-400">{t('common.loading')}</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-sm text-dark-400">{t('notifications.noNotifications')}</div>
            ) : (
              notifications.map((notification) => {
                const { cardId, spaceName } = getCardInfo(notification)
                const isClickable = !!cardId && !!onCardClick

                return (
                  <div
                    key={notification.id}
                    onClick={isClickable ? () => handleNotificationClick(notification) : undefined}
                    className={`px-4 py-3 border-b border-dark-700 last:border-b-0 ${
                      notification.read ? 'bg-dark-800' : 'bg-dark-900'
                    } ${isClickable ? 'cursor-pointer hover:bg-dark-700/50 transition-colors' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Space name badge */}
                        {spaceName && (
                          <div className="text-[10px] text-primary-400 font-medium mb-1 truncate">
                            {spaceName}
                          </div>
                        )}
                        {/* Card title with link icon if clickable */}
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm text-dark-100 font-medium truncate flex-1">
                            {notification.title}
                          </div>
                          {isClickable && (
                            <ExternalLink className="w-3 h-3 text-dark-400 flex-shrink-0" />
                          )}
                        </div>
                        {notification.message && (
                          <div className="text-xs text-dark-300 mt-1 break-words max-h-10 overflow-hidden">
                            {notification.message}
                          </div>
                        )}
                        <div className="text-[11px] text-dark-500 mt-2">
                          {formatDate(notification.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {!notification.read && (
                          <button
                            onClick={() => onMarkRead(notification.id)}
                            className="p-1 text-dark-400 hover:text-green-400"
                            title={t('notifications.markRead')}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onRemove(notification.id)}
                          className="p-1 text-dark-400 hover:text-red-400"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
