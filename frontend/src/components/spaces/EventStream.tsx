import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Activity, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Edit3, 
  Trash2, 
  Plus, 
  MessageSquare,
  ArrowRight,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import api from '@/api/client'
import { useAuthStore } from '@/stores/auth'

interface EventItem {
  id: number
  event_type: string
  card_id: string
  card_name: string | null
  space_id: string | null
  space_name: string | null
  actor_id: string | null
  actor_type: string | null
  event_data: string | null
  is_urgent: boolean
  created_at: string
}

async function fetchEvents(): Promise<EventItem[]> {
  const response = await api.get<EventItem[]>('/dashboard/events', {
    params: { limit: 50 }
  })
  return response.data
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'card_created':
      return <Plus className="w-4 h-4 text-green-400" />
    case 'card_updated':
      return <Edit3 className="w-4 h-4 text-blue-400" />
    case 'card_deleted':
      return <Trash2 className="w-4 h-4 text-red-400" />
    case 'card_moved':
      return <ArrowRight className="w-4 h-4 text-purple-400" />
    case 'comment_created':
      return <MessageSquare className="w-4 h-4 text-cyan-400" />
    default:
      return <Activity className="w-4 h-4 text-dark-400" />
  }
}

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case 'card_created': return 'created'
    case 'card_updated': return 'updated'
    case 'card_deleted': return 'deleted'
    case 'card_moved': return 'moved'
    case 'comment_created': return 'commented on'
    default: return eventType.replace('_', ' ')
  }
}

function getEventColor(eventType: string, isUrgent: boolean): string {
  if (isUrgent) return 'border-l-red-500 bg-red-500/5'
  switch (eventType) {
    case 'card_created': return 'border-l-green-500'
    case 'card_deleted': return 'border-l-red-500'
    case 'comment_created': return 'border-l-cyan-500'
    default: return 'border-l-dark-500'
  }
}

export default function EventStream() {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'cards' | 'comments'>('all')
  const { isAuthenticated } = useAuthStore()
  
  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['event-stream'],
    queryFn: fetchEvents,
    refetchInterval: 15000, // Refresh every 15 seconds
    enabled: isAuthenticated,
    retry: 3,
    retryDelay: 1000,
  })
  
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    if (filter === 'urgent') return event.is_urgent
    if (filter === 'cards') return event.event_type.startsWith('card_')
    if (filter === 'comments') return event.event_type === 'comment_created'
    return true
  })

  if (!isAuthenticated) {
    return (
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-center justify-center gap-2 text-dark-400 py-4">
          <AlertTriangle className="w-5 h-5" />
          <span>Login required to view events</span>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-dark-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex flex-col items-center gap-2 text-amber-400 py-4">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">Event stream unavailable</span>
          <button
            onClick={() => refetch()}
            className="mt-2 px-3 py-1 text-sm bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-white"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const urgentCount = events.filter(e => e.is_urgent).length

  return (
    <div className="bg-dark-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Event Stream
          {urgentCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
              {urgentCount} urgent
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-dark-700 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === 'all' ? 'bg-dark-600 text-white' : 'text-dark-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('urgent')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === 'urgent' ? 'bg-red-500/20 text-red-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              Urgent
            </button>
            <button
              onClick={() => setFilter('cards')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === 'cards' ? 'bg-blue-500/20 text-blue-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setFilter('comments')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === 'comments' ? 'bg-cyan-500/20 text-cyan-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              Comments
            </button>
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-dark-400 text-center py-8 text-sm">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No events found
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`flex items-start gap-3 p-3 bg-dark-700 rounded-lg border-l-2 ${getEventColor(event.event_type, event.is_urgent)} hover:bg-dark-650 transition-colors`}
            >
              <div className="mt-0.5">
                {event.is_urgent ? (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                ) : (
                  getEventIcon(event.event_type)
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-dark-300">
                    {event.actor_type === 'agent' ? '🤖' : '👤'}
                  </span>
                  <span className="text-white font-medium truncate">
                    {event.card_name || event.card_id.slice(0, 8)}
                  </span>
                  <span className="text-dark-400">
                    {getEventLabel(event.event_type)}
                  </span>
                </div>
                
                {event.space_name && (
                  <div className="text-xs text-dark-500 mt-1">
                    in {event.space_name}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-dark-500 whitespace-nowrap">
                <Clock className="w-3 h-3" />
                {event.created_at ? formatDistanceToNow(new Date(event.created_at), { addSuffix: true }) : 'Unknown'}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-3 text-xs text-dark-500 text-center">
        Auto-refreshes every 15 seconds • Showing last {filteredEvents.length} events
      </div>
    </div>
  )
}
