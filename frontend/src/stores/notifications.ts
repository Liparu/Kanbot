import { create } from 'zustand'
import type { Notification } from '@/types'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markRead: (notificationId: string) => void
  markAllRead: () => void
  removeNotification: (notificationId: string) => void
}

const sortNotifications = (items: Notification[]) =>
  [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

const countUnread = (items: Notification[]) =>
  items.reduce((count, item) => count + (item.read ? 0 : 1), 0)

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set(() => {
      const sorted = sortNotifications(notifications)
      return {
        notifications: sorted,
        unreadCount: countUnread(sorted),
      }
    }),

  addNotification: (notification) =>
    set((state) => {
      const next = sortNotifications([notification, ...state.notifications])
      return {
        notifications: next,
        unreadCount: countUnread(next),
      }
    }),

  markRead: (notificationId) =>
    set((state) => {
      const next = state.notifications.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item
      )
      return {
        notifications: next,
        unreadCount: countUnread(next),
      }
    }),

  markAllRead: () =>
    set((state) => {
      const next = state.notifications.map((item) => ({ ...item, read: true }))
      return {
        notifications: next,
        unreadCount: 0,
      }
    }),

  removeNotification: (notificationId) =>
    set((state) => {
      const next = state.notifications.filter((item) => item.id !== notificationId)
      return {
        notifications: next,
        unreadCount: countUnread(next),
      }
    }),
}))