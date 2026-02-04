import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Activity, 
  Bot, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Terminal,
  Calendar,
  Server,
  AlertTriangle
} from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { AgentStatus, CronJobStatus, RecentTask, SystemError } from '@/types'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    idle: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    offline: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    healthy: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    unknown: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }
  
  const style = styles[status as keyof typeof styles] || styles.unknown
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${style}`}>
      {status}
    </span>
  )
}

function AgentCard({ agent }: { agent: AgentStatus }) {
  const icons = {
    active: <Activity className="w-4 h-4 text-green-400" />,
    idle: <Clock className="w-4 h-4 text-yellow-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    offline: <AlertCircle className="w-4 h-4 text-gray-400" />,
  }
  
  return (
    <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-dark-100">{agent.name}</span>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      {agent.last_seen && (
        <p className="text-xs text-dark-500">
          Last seen: {new Date(agent.last_seen).toLocaleString()}
        </p>
      )}
      {agent.current_task && (
        <p className="text-xs text-dark-400 mt-1">
          Task: {agent.current_task}
        </p>
      )}
    </div>
  )
}

function CronJobCard({ job }: { job: CronJobStatus }) {
  return (
    <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-dark-100">{job.name}</span>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <p className="text-xs text-dark-500">Schedule: {job.schedule}</p>
      {job.last_run && (
        <p className="text-xs text-dark-400 mt-1">
          Last run: {new Date(job.last_run).toLocaleString()}
        </p>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: RecentTask }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg border border-dark-600">
      <div className="p-2 bg-primary-500/10 rounded-lg">
        <Terminal className="w-4 h-4 text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-100 truncate">{task.action}</p>
        <p className="text-xs text-dark-500">
          by {task.actor_name} ({task.actor_type})
        </p>
      </div>
      <span className="text-xs text-dark-500">
        {new Date(task.created_at).toLocaleTimeString()}
      </span>
    </div>
  )
}

function ErrorRow({ error }: { error: SystemError }) {
  const severityIcons = {
    info: <CheckCircle className="w-4 h-4 text-blue-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    critical: <AlertCircle className="w-4 h-4 text-red-500" />,
  }
  
  return (
    <div className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg border border-dark-600">
      <div className="p-2 bg-red-500/10 rounded-lg">
        {severityIcons[error.severity] || severityIcons.error}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-100 truncate">{error.message}</p>
        <p className="text-xs text-dark-500">
          {error.source} • {new Date(error.timestamp).toLocaleString()}
        </p>
      </div>
      <StatusBadge status={error.severity} />
    </div>
  )
}

function HealthCard({ health }: { health: { status: string; agent_count: number; active_agents: number; cron_count: number; failed_crons: number; error_count: number; timestamp: string } }) {
  const statusColors = {
    healthy: 'text-green-400 bg-green-500/10 border-green-500/20',
    warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  }
  
  const statusColor = statusColors[health.status as keyof typeof statusColors] || statusColors.healthy
  
  return (
    <div className={`rounded-xl p-6 border ${statusColor}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          <h3 className="font-medium">System Health</h3>
        </div>
        <span className="text-2xl font-bold uppercase">{health.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="opacity-70">Agents:</span>{' '}
          <span className="font-medium">{health.active_agents}/{health.agent_count}</span>
        </div>
        <div>
          <span className="opacity-70">Crons:</span>{' '}
          <span className="font-medium">{health.cron_count - health.failed_crons}/{health.cron_count}</span>
        </div>
        <div>
          <span className="opacity-70">Errors:</span>{' '}
          <span className="font-medium">{health.error_count}</span>
        </div>
        <div>
          <span className="opacity-70">Updated:</span>{' '}
          <span className="font-medium">{new Date(health.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard-status'],
    queryFn: dashboardApi.getStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2,
  })

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-dark-100">Qratos Status Dashboard</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-dark-400 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-dark-100">Qratos Status Dashboard</h1>
        </div>
        <div className="text-center py-12 bg-dark-800 rounded-xl border border-dark-700">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-2">Failed to load dashboard</p>
          <p className="text-dark-500 text-sm mb-4">{(error as Error)?.message || 'Unknown error'}</p>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-dark-100">Qratos Status Dashboard</h1>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Health Overview */}
      <div className="mb-8">
        <HealthCard health={data.system_health} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agents Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-medium text-dark-100">Agent Status</h2>
            <span className="ml-auto text-sm text-dark-500">
              {data.agents.filter(a => a.status === 'active').length} active
            </span>
          </div>
          <div className="space-y-3">
            {data.agents.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
            {data.agents.length === 0 && (
              <p className="text-center text-dark-500 py-4">No agents found</p>
            )}
          </div>
        </section>

        {/* Cron Jobs Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-medium text-dark-100">Cron Jobs</h2>
            <span className="ml-auto text-sm text-dark-500">
              {data.cron_jobs.filter(j => j.status !== 'failed').length} healthy
            </span>
          </div>
          <div className="space-y-3">
            {data.cron_jobs.map((job) => (
              <CronJobCard key={job.name} job={job} />
            ))}
            {data.cron_jobs.length === 0 && (
              <p className="text-center text-dark-500 py-4">No cron jobs found</p>
            )}
          </div>
        </section>

        {/* Recent Tasks Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-medium text-dark-100">Recent Tasks</h2>
            <span className="ml-auto text-sm text-dark-500">
              {data.recent_tasks.length} items
            </span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recent_tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
            {data.recent_tasks.length === 0 && (
              <p className="text-center text-dark-500 py-4">No recent tasks</p>
            )}
          </div>
        </section>

        {/* Errors Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-medium text-dark-100">System Errors</h2>
            <span className="ml-auto text-sm text-dark-500">
              {data.errors.length} items
            </span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.errors.map((error, index) => (
              <ErrorRow key={index} error={error} />
            ))}
            {data.errors.length === 0 && (
              <div className="text-center py-8 bg-dark-800 rounded-xl border border-dark-700">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 text-sm">No errors detected</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
