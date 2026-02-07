import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle, PlayCircle, Circle, AlertCircle } from 'lucide-react'
import { dashboardApi, CronJobStatus } from '@/api/dashboard'

interface CronJob {
  name: string
  status: 'running' | 'success' | 'failed' | 'pending' | 'unknown'
  scheduledTime: string // HH:MM format
  lastRun?: string
  nextRun?: string
  schedule?: string
}

interface ScheduleTimelineProps {
  className?: string
}

// Convert API cron job to our display format
function apiToDisplayJob(job: CronJobStatus): CronJob {
  // Parse schedule to get time (simplified - assumes daily jobs)
  let scheduledTime = '00:00'
  if (job.next_run) {
    const date = new Date(job.next_run)
    scheduledTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } else if (job.schedule) {
    // Try to parse cron expression for hour/minute
    const parts = job.schedule.split(' ')
    if (parts.length >= 2) {
      const minute = parts[0] === '*' ? '00' : parts[0].padStart(2, '0')
      const hour = parts[1] === '*' ? '**' : parts[1].padStart(2, '0')
      scheduledTime = `${hour}:${minute}`
    }
  }
  
  return {
    name: job.name,
    status: job.status as CronJob['status'],
    scheduledTime,
    lastRun: job.last_run || undefined,
    nextRun: job.next_run || undefined,
    schedule: job.schedule,
  }
}

export default function ScheduleTimeline({ className = '' }: ScheduleTimelineProps) {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard-status'],
    queryFn: dashboardApi.getStatus,
    refetchInterval: 30000, // Refresh every 30s
  })

  const jobs = useMemo(() => {
    if (!dashboardData?.cron_jobs) return []
    return dashboardData.cron_jobs.map(apiToDisplayJob)
  }, [dashboardData])
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
  }, [jobs])

  if (isLoading) {
    return (
      <div className={`bg-dark-800 rounded-lg border border-dark-700 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold text-dark-100">Today's Schedule</h3>
        </div>
        <div className="text-dark-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-dark-800 rounded-lg border border-dark-700 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load schedule</span>
        </div>
      </div>
    )
  }

  const getStatusIcon = (status: CronJob['status']) => {
    switch (status) {
      case 'running':
        return <PlayCircle className="w-4 h-4 text-green-400 animate-pulse" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-gray-400" />
      case 'failed':
        return <Circle className="w-4 h-4 text-red-400" />
      case 'unknown':
        return <Circle className="w-4 h-4 text-yellow-400" />
      default:
        return <Circle className="w-4 h-4 text-blue-400" />
    }
  }

  const getStatusColor = (status: CronJob['status'], scheduledTime: string) => {
    if (status === 'success') return 'bg-dark-600 border-dark-500'
    if (status === 'running') return 'bg-green-900/30 border-green-500'
    if (status === 'failed') return 'bg-red-900/30 border-red-500'
    // Pending - check if it's next up
    if (scheduledTime > currentTimeStr) return 'bg-blue-900/20 border-blue-500/50'
    return 'bg-dark-700 border-dark-600'
  }

  const nextJob = sortedJobs.find(j => j.scheduledTime > currentTimeStr && (j.status === 'pending' || j.status === 'unknown'))

  if (jobs.length === 0) {
    return (
      <div className={`bg-dark-800 rounded-lg border border-dark-700 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold text-dark-100">Today's Schedule</h3>
        </div>
        <div className="text-dark-400 text-sm">No scheduled jobs</div>
      </div>
    )
  }

  return (
    <div className={`bg-dark-800 rounded-lg border border-dark-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold text-dark-100">Today's Schedule</h3>
        </div>
        <div className="text-sm text-dark-400">
          Now: <span className="text-dark-200 font-mono">{currentTimeStr}</span>
        </div>
      </div>

      {nextJob && (
        <div className="mb-4 px-3 py-2 bg-primary-900/20 border border-primary-500/30 rounded-lg">
          <div className="text-xs text-primary-400 uppercase tracking-wide">Next Up</div>
          <div className="text-dark-100 font-medium">{nextJob.name}</div>
          <div className="text-sm text-dark-400">at {nextJob.scheduledTime}</div>
        </div>
      )}

      <div className="space-y-2">
        {sortedJobs.map((job, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${getStatusColor(job.status, job.scheduledTime)}`}
          >
            <div className="font-mono text-sm text-dark-400 w-12">{job.scheduledTime}</div>
            {getStatusIcon(job.status)}
            <div className="flex-1 text-dark-200 text-sm truncate">{job.name}</div>
            {job.lastRun && (
              <div className="text-xs text-dark-500">ran {job.lastRun}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
