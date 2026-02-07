import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle, XCircle, Loader2, Play, Pause, RefreshCw } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface CronJob {
  name: string
  status: 'running' | 'success' | 'error' | 'pending'
  last_run: string | null
  next_run: string
  schedule: string
}

interface DashboardStats {
  cron_jobs: CronJob[]
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const token = localStorage.getItem('token')
  const response = await fetch('/api/v1/dashboard/status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!response.ok) throw new Error('Failed to fetch dashboard stats')
  return response.json()
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />
    default:
      return <Clock className="w-4 h-4 text-dark-400" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'running': return 'bg-blue-500/20 text-blue-400'
    case 'success': return 'bg-green-500/20 text-green-400'
    case 'error': return 'bg-red-500/20 text-red-400'
    default: return 'bg-dark-600 text-dark-300'
  }
}

export default function CronJobsMonitor() {
  const [filter, setFilter] = useState<'all' | 'running' | 'error'>('all')
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const cronJobs = data?.cron_jobs || []
  
  const filteredJobs = cronJobs.filter(job => {
    if (filter === 'all') return true
    if (filter === 'running') return job.status === 'running'
    if (filter === 'error') return job.status === 'error'
    return true
  })

  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-dark-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="text-red-400 text-center py-4">
          Failed to load cron jobs
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Scheduled Jobs
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
              onClick={() => setFilter('running')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === 'running' ? 'bg-blue-500/20 text-blue-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              Running
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === 'error' ? 'bg-red-500/20 text-red-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              Errors
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

      <div className="space-y-2">
        {filteredJobs.length === 0 ? (
          <div className="text-dark-400 text-center py-4 text-sm">
            No scheduled jobs found
          </div>
        ) : (
          filteredJobs.map((job, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-dark-700 rounded-lg hover:bg-dark-650 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(job.status)}
                <div>
                  <div className="text-sm font-medium text-white">{job.name}</div>
                  <div className="text-xs text-dark-400 font-mono">{job.schedule}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-dark-400">Next run</div>
                  <div className="text-sm text-dark-200">
                    {job.next_run ? formatDistanceToNow(new Date(job.next_run), { addSuffix: true }) : '-'}
                  </div>
                </div>
                
                <div className="text-right min-w-[80px]">
                  <div className="text-xs text-dark-400">Last run</div>
                  <div className="text-sm text-dark-200">
                    {job.last_run 
                      ? formatDistanceToNow(new Date(job.last_run), { addSuffix: true })
                      : 'Never'}
                  </div>
                </div>

                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-3 text-xs text-dark-500 text-center">
        Auto-refreshes every 30 seconds
      </div>
    </div>
  )
}
