import api from './client'
import type { Space, SpaceMember } from '@/types'

interface InviteMemberData {
  email: string
  role?: 'member' | 'guest'
}

export const spacesApi = {
  list: async (): Promise<Space[]> => {
    const response = await api.get('/spaces')
    return response.data
  },

  get: async (spaceId: string): Promise<Space> => {
    const response = await api.get(`/spaces/${spaceId}`)
    return response.data
  },

  stats: async (spaceId: string): Promise<{
    space_id: string
    total_cards: number
    waiting_cards: number
    urgent_cards: number
    inbox_cards: number
    in_progress_cards: number
    review_cards: number
    archive_cards: number
  }> => {
    const response = await api.get(`/spaces/${spaceId}/stats`)
    return response.data
  },

  create: async (data: { name: string; type: 'personal' | 'company' | 'agent' }): Promise<Space> => {
    const response = await api.post('/spaces', data)
    return response.data
  },

  update: async (spaceId: string, data: Partial<Space>): Promise<Space> => {
    const response = await api.patch(`/spaces/${spaceId}`, data)
    return response.data
  },

  delete: async (spaceId: string): Promise<void> => {
    await api.delete(`/spaces/${spaceId}`)
  },

  invite: async (spaceId: string, data: InviteMemberData): Promise<SpaceMember> => {
    const response = await api.post(`/spaces/${spaceId}/invite`, data)
    return response.data
  },

  removeMember: async (spaceId: string, userId: string): Promise<void> => {
    await api.delete(`/spaces/${spaceId}/members/${userId}`)
  },
}
