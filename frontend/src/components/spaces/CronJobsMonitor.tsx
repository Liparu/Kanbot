import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle, XCircle, Loader2, RefreshCw, AlertCircle, PlayCircle, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import api from '@/api/client'
import { useAuthStore } from '@/stores/auth'

interface CronJob {
  name: string
  status: 'running' | 'success' | 'error' | 'pending'
  last_run: string | null
  next_run: string
  schedule: string
}

async function fetchCronJobs(): Promise<CronJob[]> {
  const response = await api.get<CronJob[]>('/dashboard/cron-jobs')
  return response.data
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

function getTimeFromJob(job: CronJob): string {
  if (job.next_run) {
    const date = new Date(job.next_run)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  return '--:--'
}

// Extract clean card name from job name (remove emoji prefixes)
function extractCardName(jobName: string): string {
  return jobName.replace(/^[📋💻🌙🔍📊⏰🔭📣🎯☀️📅📁🔧💾🗓️👁️📚🧠⚡🔄]/g, '').trim()
}

export default function CronJobsMonitor() {
  const [filter, setFilter] = useState<'all' | 'running' | 'error'>('all')
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const handleJobClick = (jobName: string) => {
    const cardName = extractCardName(jobName)
    navigate(`/search?q=${encodeURIComponent(cardName)}`)
  }
  
  const { data: cronJobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: fetchCronJobs,
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: isAuthenticated, // Only fetch when authenticated
    retry: 3, // Retry up to 3 times on failure
    retryDelay: 1000, // Wait 1 second between retries
  })

  // Current time for timeline
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`

  // Find next upcoming job
  const nextJob = useMemo(() => {
    const upcoming = cronJobs
      .filter(job => {
        if (!job.next_run) return false
        const jobTime = getTimeFromJob(job)
        return jobTime > currentTimeStr
      })
      .sort((a, b) => getTimeFromJob(a).localeCompare(getTimeFromJob(b)))
    return upcoming[0] || null
  }, [cronJobs, currentTimeStr])

  // Get today's jobs sorted by time
  const todaysJobs = useMemo(() => {
    return [...cronJobs]
      .filter(job => job.next_run) // Only jobs with scheduled times
      .sort((a, b) => getTimeFromJob(a).localeCompare(getTimeFromJob(b)))
      .slice(0, 8) // Show max 8 in mini timeline
  }, [cronJobs])
  
  const filteredJobs = cronJobs.filter(job => {
    if (filter === 'all') return true
    if (filter === 'running') return job.status === 'running'
    if (filter === 'error') return job.status === 'error'
    return true
  })

  if (!isAuthenticated) {
    return (
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-center justify-center gap-2 text-dark-400 py-4">
          <AlertCircle className="w-5 h-5" />
          <span>Login required to view scheduled jobs</span>
        </div>
      </div>
    )
  }

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return (
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex flex-col items-center gap-2 text-red-400 py-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load cron jobs</span>
          </div>
          <div className="text-xs text-dark-500">{errorMessage}</div>
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

  return (
    <div className="bg-dark-800 rounded-lg p-4">
      {/* Header with current time */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Scheduled Jobs
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-dark-400">
            Now: <span className="font-mono text-dark-200">{currentTimeStr}</span>
          </span>
          <button
            onClick={() => refetch()}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Next Up highlight */}
      {nextJob && (
        <div className="mb-4 px-3 py-2 bg-primary-900/20 border border-primary-500/30 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-xs text-primary-400 uppercase tracking-wide flex items-center gap-1">
              <PlayCircle className="w-3 h-3" /> Next Up
            </div>
            <div className="text-dark-100 font-medium">{nextJob.name}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-dark-400">at</div>
            <div className="font-mono text-dark-200">{getTimeFromJob(nextJob)}</div>
          </div>
        </div>
      )}

      {/* Mini Timeline */}
      {todaysJobs.length > 0 && (
        <div className="mb-4 flex gap-1 overflow-x-auto pb-2">
          {todaysJobs.map((job, idx) => {
            const jobTime = getTimeFromJob(job)
            const isPast = jobTime < currentTimeStr
            const isNext = nextJob && job.name === nextJob.name
            
            return (
              <div
                key={idx}
                className={`flex-shrink-0 px-2 py-1 rounded text-xs font-mono ${
                  isNext 
                    ? 'bg-primary-500/30 text-primary-300 border border-primary-500/50' 
                    : isPast 
                      ? 'bg-dark-700 text-dark-500' 
                      : 'bg-dark-600 text-dark-300'
                }`}
                title={job.name}
              >
                {jobTime}
              </div>
            )
          })}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex bg-dark-700 rounded-lg p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              filter === 'all' ? 'bg-dark-600 text-white' : 'text-dark-400 hover:text-white'
            }`}
          >
            All ({cronJobs.length})
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
      </div>

      {/* Jobs list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
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
                  <button
                    onClick={() => handleJobClick(job.name)}
                    className="text-sm font-medium text-white hover:text-primary-400 transition-colors flex items-center gap-1.5 text-left"
                    title="Click to find related card"
                  >
                    {job.name}
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </button>
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
