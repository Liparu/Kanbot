import api from './client'

export interface CalendarEvent {
  id: string
  calendar_id: string
  card_id?: string
  google_event_id?: string
  title: string
  description?: string
  start_date: string
  end_date?: string
  all_day: boolean
  location?: string
  color?: string
  created_at: string
  updated_at: string
}

export interface Calendar {
  id: string
  space_id: string
  google_calendar_id?: string
  settings: Record<string, unknown>
  created_at: string
}

export interface CreateEventData {
  calendar_id: string
  card_id?: string
  title: string
  description?: string
  start_date: string
  end_date?: string
  all_day?: boolean
  location?: string
  color?: string
}

export interface UpdateEventData {
  title?: string
  description?: string
  start_date?: string
  end_date?: string
  all_day?: boolean
  location?: string
  color?: string
}

export interface GoogleCalendarStatus {
  configured: boolean
  connected: boolean
}

export interface GoogleCalendar {
  id: string
  summary: string
  primary: boolean
  background_color?: string
}

export interface GoogleEvent {
  id: string
  summary: string
  description?: string
  start: string
  end?: string
  location?: string
  status?: string
  html_link?: string
}

export const calendarApi = {
  getSpaceCalendar: async (spaceId: string): Promise<Calendar> => {
    const response = await api.get(`/calendar/space/${spaceId}`)
    return response.data
  },

  listEvents: async (params?: {
    calendar_ids?: string[]
    start_date?: string
    end_date?: string
  }): Promise<CalendarEvent[]> => {
    const response = await api.get('/calendar/events', { params })
    return response.data
  },

  createEvent: async (data: CreateEventData): Promise<CalendarEvent> => {
    const response = await api.post('/calendar/events', data)
    return response.data
  },

  updateEvent: async (eventId: string, data: UpdateEventData): Promise<CalendarEvent> => {
    const response = await api.patch(`/calendar/events/${eventId}`, data)
    return response.data
  },

  deleteEvent: async (eventId: string): Promise<void> => {
    await api.delete(`/calendar/events/${eventId}`)
  },

  getGoogleStatus: async (): Promise<GoogleCalendarStatus> => {
    const response = await api.get('/calendar/google/status')
    return response.data
  },

  getGoogleAuthUrl: async (redirectUri: string, spaceId: string): Promise<{ auth_url: string }> => {
    const response = await api.get('/calendar/google/auth-url', {
      params: { redirect_uri: redirectUri, space_id: spaceId }
    })
    return response.data
  },

  googleCallback: async (code: string, state: string, redirectUri: string): Promise<{ success: boolean }> => {
    const response = await api.post('/calendar/google/callback', null, {
      params: { code, state, redirect_uri: redirectUri }
    })
    return response.data
  },

  disconnectGoogle: async (): Promise<{ success: boolean }> => {
    const response = await api.delete('/calendar/google/disconnect')
    return response.data
  },

  listGoogleCalendars: async (): Promise<GoogleCalendar[]> => {
    const response = await api.get('/calendar/google/calendars')
    return response.data
  },

  listGoogleEvents: async (params?: {
    calendar_id?: string
    time_min?: string
    time_max?: string
  }): Promise<{ items: GoogleEvent[]; next_sync_token?: string }> => {
    const response = await api.get('/calendar/google/events', { params })
    return response.data
  },

  createGoogleEvent: async (data: {
    calendar_id: string
    summary: string
    start: string
    end?: string
    description?: string
    location?: string
    all_day?: boolean
  }): Promise<{ id: string; summary: string; html_link?: string }> => {
    const response = await api.post('/calendar/google/events', null, { params: data })
    return response.data
  },

  deleteGoogleEvent: async (eventId: string, calendarId?: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/calendar/google/events/${eventId}`, {
      params: calendarId ? { calendar_id: calendarId } : undefined
    })
    return response.data
  },
}
