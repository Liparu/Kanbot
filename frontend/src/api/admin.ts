import { api } from './client'
import type { AdminUser, AdminUserListResponse, SystemStats } from '@/types'

export interface GetUsersParams {
  page?: number
  page_size?: number
  search?: string
}

export interface UpdateUserData {
  email?: string
  username?: string
  is_admin?: boolean
}

export const adminApi = {
  getUsers: async (params: GetUsersParams = {}): Promise<AdminUserListResponse> => {
    const { data } = await api.get('/admin/users', { params })
    return data
  },

  getUser: async (userId: string): Promise<AdminUser> => {
    const { data } = await api.get(`/admin/users/${userId}`)
    return data
  },

  updateUser: async (userId: string, updateData: UpdateUserData): Promise<AdminUser> => {
    const { data } = await api.patch(`/admin/users/${userId}`, updateData)
    return data
  },

  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/admin/users/${userId}`)
  },

  banUser: async (userId: string, isBanned: boolean): Promise<AdminUser> => {
    const { data } = await api.post(`/admin/users/${userId}/ban`, { is_banned: isBanned })
    return data
  },

  getStats: async (): Promise<SystemStats> => {
    const { data } = await api.get('/admin/stats')
    return data
  },
}
