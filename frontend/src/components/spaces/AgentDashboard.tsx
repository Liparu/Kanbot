import { useParams, Navigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bot, Loader2, AlertCircle } from 'lucide-react'
import api from '@/api/client'
import SubAgentWidget from './SubAgentWidget'
import CronJobsMonitor from './CronJobsMonitor'
import EventStream from './EventStream'
import ScheduleTimeline from './ScheduleTimeline'

interface Space {
  id: string
  name: string
  type: 'personal' | 'company' | 'agent'
}

export default function AgentDashboard() {
  const { spaceId } = useParams<{ spaceId: string }>()

  const { data: space, isLoading, error } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: async () => {
      const response = await api.get<Space>(`/spaces/${spaceId}`)
      return response.data
    },
    enabled: !!spaceId,
  })

  if (!spaceId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">Space not found</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-dark-400" />
      </div>
    )
  }

  if (error || !space) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Failed to load space
        </div>
      </div>
    )
  }

  // Only show dashboard for agent spaces
  if (space.type !== 'agent') {
    return <Navigate to={`/spaces/${spaceId}`} replace />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/spaces/${spaceId}`}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary-400" />
          <h1 className="text-2xl font-bold text-white">Agent Dashboard</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <ScheduleTimeline />
          <CronJobsMonitor />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <SubAgentWidget spaceId={spaceId} />
          <EventStream />
        </div>
      </div>
    </div>
  )
}
