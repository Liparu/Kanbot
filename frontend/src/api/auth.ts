import api from './client'
import type { User, APIKey } from '@/types'

interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)
    
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return response.data
  },

  register: async (email: string, username: string, password: string, language: string = 'en'): Promise<LoginResponse> => {
    const response = await api.post('/auth/register', {
      email,
      username,
      password,
      language,
    })
    return response.data
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },

  createApiKey: async (name: string): Promise<APIKey & { key: string }> => {
    const response = await api.post('/auth/api-keys', { name })
    return response.data
  },

  listApiKeys: async (): Promise<APIKey[]> => {
    const response = await api.get('/auth/api-keys')
    return response.data
  },

  deleteApiKey: async (keyId: string): Promise<void> => {
    await api.delete(`/auth/api-keys/${keyId}`)
  },
}
