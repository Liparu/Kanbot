import api from './client'

export interface FilterTemplate {
  id: string
  space_id: string
  name: string
  filters: Record<string, unknown>
  created_by?: string | null
  created_at: string
}

export const filterTemplatesApi = {
  list: async (spaceId: string): Promise<FilterTemplate[]> => {
    const response = await api.get('/filter-templates', { params: { space_id: spaceId } })
    return response.data
  },

  create: async (data: { space_id: string; name: string; filters: Record<string, unknown> }): Promise<FilterTemplate> => {
    const response = await api.post('/filter-templates', data)
    return response.data
  },

  update: async (templateId: string, data: Partial<FilterTemplate>): Promise<FilterTemplate> => {
    const response = await api.patch(`/filter-templates/${templateId}`, data)
    return response.data
  },

  delete: async (templateId: string): Promise<void> => {
    await api.delete(`/filter-templates/${templateId}`)
  },
}