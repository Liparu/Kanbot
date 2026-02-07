import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bot } from 'lucide-react'
import SubAgentWidget from './SubAgentWidget'
import ScheduleTimeline from './ScheduleTimeline'
import CronJobsMonitor from './CronJobsMonitor'

export default function AgentDashboard() {
  const { spaceId } = useParams<{ spaceId: string }>()

  if (!spaceId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">Space not found</div>
      </div>
    )
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
        </div>
      </div>
    </div>
  )
}
