import api from './client'
import type { Column, Card, Task, Comment, Tag } from '@/types'

export const columnsApi = {
  list: async (spaceId: string): Promise<Column[]> => {
    const response = await api.get('/columns', { params: { space_id: spaceId } })
    return response.data
  },

  create: async (data: { name: string; space_id: string; category?: string }): Promise<Column> => {
    const response = await api.post('/columns', data)
    return response.data
  },

  update: async (columnId: string, data: Partial<Column>): Promise<Column> => {
    const response = await api.patch(`/columns/${columnId}`, data)
    return response.data
  },

  delete: async (columnId: string): Promise<void> => {
    await api.delete(`/columns/${columnId}`)
  },

  reorder: async (columnIds: string[]): Promise<void> => {
    await Promise.all(
      columnIds.map((id, index) => 
        api.patch(`/columns/${id}`, { position: index })
      )
    )
  },
}

export const cardsApi = {
  list: async (params?: {
    space_id?: string
    column_id?: string
    assignee_id?: string
    tag_id?: string
    search?: string
  }): Promise<Card[]> => {
    const response = await api.get('/cards', { params })
    return response.data
  },

  get: async (cardId: string): Promise<Card> => {
    const response = await api.get(`/cards/${cardId}`)
    return response.data
  },

  create: async (data: {
    column_id: string
    name: string
    description?: string
    start_date?: string
    end_date?: string
    location?: string
    assignee_ids?: string[]
    tag_ids?: string[]
  }): Promise<Card> => {
    const response = await api.post('/cards', data)
    return response.data
  },

  update: async (cardId: string, data: Partial<Card & { assignee_ids?: string[]; tag_ids?: string[] }> & { start_date?: string | null; end_date?: string | null }): Promise<Card> => {
    const response = await api.patch(`/cards/${cardId}`, data)
    return response.data
  },

  move: async (cardId: string, columnId: string, position?: number): Promise<Card> => {
    const response = await api.post(`/cards/${cardId}/move`, { column_id: columnId, position })
    return response.data
  },

  delete: async (cardId: string): Promise<void> => {
    await api.delete(`/cards/${cardId}`)
  },

  addTask: async (cardId: string, data: { text: string }): Promise<Task> => {
    const response = await api.post(`/cards/${cardId}/tasks`, data)
    return response.data
  },

  updateTask: async (cardId: string, taskId: string, data: Partial<Task>): Promise<Task> => {
    const response = await api.patch(`/cards/${cardId}/tasks/${taskId}`, data)
    return response.data
  },

  deleteTask: async (cardId: string, taskId: string): Promise<void> => {
    await api.delete(`/cards/${cardId}/tasks/${taskId}`)
  },

  addComment: async (cardId: string, data: { content: string }): Promise<Comment> => {
    const response = await api.post(`/cards/${cardId}/comments`, data)
    return response.data
  },

  updateComment: async (cardId: string, commentId: string, data: { content: string }): Promise<Comment> => {
    const response = await api.patch(`/cards/${cardId}/comments/${commentId}`, data)
    return response.data
  },

  deleteComment: async (cardId: string, commentId: string): Promise<Comment> => {
    const response = await api.delete(`/cards/${cardId}/comments/${commentId}`)
    return response.data
  },

  getHistory: async (cardId: string): Promise<unknown[]> => {
    const response = await api.get(`/cards/${cardId}/history`)
    return response.data
  },
}

export const tagsApi = {
  list: async (spaceId: string): Promise<Tag[]> => {
    const response = await api.get('/tags', { params: { space_id: spaceId } })
    return response.data
  },

  create: async (spaceId: string, data: { name: string; color: string; is_predefined?: boolean }): Promise<Tag> => {
    const response = await api.post('/tags', data, { params: { space_id: spaceId } })
    return response.data
  },

  update: async (tagId: string, data: Partial<Tag>): Promise<Tag> => {
    const response = await api.patch(`/tags/${tagId}`, data)
    return response.data
  },

  delete: async (tagId: string): Promise<void> => {
    await api.delete(`/tags/${tagId}`)
  },
}

export interface ScheduledCard {
  id: string
  space_id: string
  column_id: string | null
  column_name: string
  name: string
  description: string | null
  interval: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  start_date: string
  end_date: string | null
  next_run: string
  last_run: string | null
  tag_ids: string[] | null
  assignee_ids: string[] | null
  tasks: string[] | null
  location: string | null
  active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ScheduledCardCreate {
  space_id: string
  column_id?: string
  column_name: string
  name: string
  description?: string
  interval: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  start_date: string
  end_date?: string
  tag_ids?: string[]
  assignee_ids?: string[]
  tasks?: string[]
  location?: string
}

export const scheduledCardsApi = {
  list: async (spaceId: string, activeOnly: boolean = true): Promise<ScheduledCard[]> => {
    const response = await api.get('/scheduled-cards', { params: { space_id: spaceId, active_only: activeOnly } })
    return response.data
  },

  get: async (scheduledCardId: string): Promise<ScheduledCard> => {
    const response = await api.get(`/scheduled-cards/${scheduledCardId}`)
    return response.data
  },

  create: async (data: ScheduledCardCreate): Promise<ScheduledCard> => {
    const response = await api.post('/scheduled-cards', data)
    return response.data
  },

  update: async (scheduledCardId: string, data: Partial<ScheduledCardCreate> & { active?: boolean }): Promise<ScheduledCard> => {
    const response = await api.patch(`/scheduled-cards/${scheduledCardId}`, data)
    return response.data
  },

  delete: async (scheduledCardId: string): Promise<void> => {
    await api.delete(`/scheduled-cards/${scheduledCardId}`)
  },

  trigger: async (scheduledCardId: string): Promise<{ status: string; card_id: string }> => {
    const response = await api.post(`/scheduled-cards/${scheduledCardId}/trigger`)
    return response.data
  },

  process: async (spaceId: string): Promise<{ status: string; cards_created: number }> => {
    const response = await api.post('/scheduled-cards/process', null, { params: { space_id: spaceId } })
    return response.data
  },
}
