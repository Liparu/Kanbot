import api from './client'
import type { Notification } from '@/types'

export const notificationsApi = {
  list: async (params?: { unread_only?: boolean; limit?: number }): Promise<Notification[]> => {
    const response = await api.get('/notifications', { params })
    return response.data
  },

  markRead: async (notificationId: string): Promise<Notification> => {
    const response = await api.post(`/notifications/${notificationId}/read`)
    return response.data
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/read-all')
  },

  remove: async (notificationId: string): Promise<void> => {
    await api.delete(`/notifications/${notificationId}`)
  },
}