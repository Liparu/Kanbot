import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  Clock, CheckCircle, XCircle, Loader2, RefreshCw, AlertCircle, 
  ExternalLink, ChevronDown, ChevronRight, Play, 
  Pause, Settings, Trash2, Plus, Power
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import api from '@/api/client'
import { useAuthStore } from '@/stores/auth'

interface CronJob {
  id?: string
  name: string
  status: 'running' | 'success' | 'error' | 'pending' | 'disabled'
  last_run: string | null
  next_run: string | null
  schedule: string
  enabled?: boolean
  description?: string
  model?: string
  card_id?: string
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
    case 'disabled':
      return <Pause className="w-4 h-4 text-dark-500" />
    default:
      return <Clock className="w-4 h-4 text-dark-400" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'running': return 'bg-blue-500/20 text-blue-400'
    case 'success': return 'bg-green-500/20 text-green-400'
    case 'error': return 'bg-red-500/20 text-red-400'
    case 'disabled': return 'bg-dark-700 text-dark-500'
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

function extractCardName(jobName: string): string {
  return jobName.replace(/^[📋💻🌙🔍📊⏰🔭📣🎯☀️📅📁🔧💾🗓️👁️📚🧠⚡🔄🔬]/g, '').trim()
}

function parseCronSchedule(schedule: string): string {
  const parts = schedule.split(' ')
  if (parts.length < 5) return schedule
  
  const [min, hour, day, month, dow] = parts
  
  // Common patterns
  if (min.includes('/') && hour === '*') {
    const interval = min.split('/')[1]
    return `Every ${interval} minutes`
  }
  if (min === '0' && hour.includes('-')) {
    const [start, end] = hour.split('-')
    return `Hourly ${start}:00-${end}:00`
  }
  if (min === '0,30' && hour.includes('-')) {
    const [start, end] = hour.split('-')
    return `Every 30min ${start}:00-${end}:00`
  }
  if (min !== '*' && hour !== '*' && day === '*' && month === '*' && dow === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
  }
  if (hour.includes('-') && (min === '0' || min === '0,20,40' || min === '0,30')) {
    const [start, end] = hour.split('-')
    return `${start}:00-${end}:00 window`
  }
  
  return schedule
}

interface JobRowProps {
  job: CronJob
  isExpanded: boolean
  onToggle: () => void
  onNavigate: (name: string) => void
  isPast: boolean
  isNext: boolean
}

function JobRow({ job, isExpanded, onToggle, onNavigate, isPast, isNext }: JobRowProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const handleAction = async (action: string) => {
    setActionLoading(action)
    // TODO: Connect to OpenClaw cron API
    await new Promise(resolve => setTimeout(resolve, 500))
    setActionLoading(null)
    alert(`Action "${action}" will be connected to OpenClaw cron API.\nJob: ${job.name}`)
  }

  return (
    <div className={`rounded-lg overflow-hidden transition-all ${
      isNext ? 'ring-1 ring-primary-500/50' : ''
    } ${isPast ? 'opacity-60' : ''}`}>
      {/* Main row */}
      <div
        onClick={onToggle}
        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
          isExpanded ? 'bg-dark-650' : 'bg-dark-700 hover:bg-dark-650'
        }`}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-dark-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-dark-400" />
          )}
          {getStatusIcon(job.status)}
          <div>
            <div className="text-sm font-medium text-white flex items-center gap-2">
              {job.name}
              {isNext && (
                <span className="text-xs bg-primary-500/30 text-primary-300 px-1.5 py-0.5 rounded">
                  Next
                </span>
              )}
            </div>
            <div className="text-xs text-dark-400">{parseCronSchedule(job.schedule)}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-dark-500">Next</div>
            <div className="text-sm text-dark-300 font-mono">
              {job.next_run ? getTimeFromJob(job) : '--:--'}
            </div>
          </div>
          
          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
        </div>
      </div>
      
      {/* Expanded details */}
      {isExpanded && (
        <div className="bg-dark-750 border-t border-dark-600 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-dark-500 mb-1">Schedule</div>
              <div className="text-sm text-dark-200 font-mono">{job.schedule}</div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Next Run</div>
              <div className="text-sm text-dark-200">
                {job.next_run 
                  ? formatDistanceToNow(new Date(job.next_run), { addSuffix: true })
                  : 'Not scheduled'}
              </div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Last Run</div>
              <div className="text-sm text-dark-200">
                {job.last_run 
                  ? formatDistanceToNow(new Date(job.last_run), { addSuffix: true })
                  : 'Never'}
              </div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Status</div>
              <div className="text-sm text-dark-200 flex items-center gap-1.5">
                {getStatusIcon(job.status)}
                <span className="capitalize">{job.status}</span>
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-3 border-t border-dark-600">
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('run'); }}
              disabled={actionLoading === 'run'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === 'run' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run Now
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('toggle'); }}
              disabled={actionLoading === 'toggle'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-dark-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Power className="w-3 h-3" />
              {job.enabled === false ? 'Enable' : 'Disable'}
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(job.name); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-dark-200 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Find Card
            </button>
            
            <div className="flex-1" />
            
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('edit'); }}
              className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
              title="Edit"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('delete'); }}
              className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CronJobsMonitor() {
  const [filter, setFilter] = useState<'all' | 'running' | 'error'>('all')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [_showAddModal, setShowAddModal] = useState(false)
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const handleJobClick = (jobName: string) => {
    const cardName = extractCardName(jobName)
    navigate(`/search?q=${encodeURIComponent(cardName)}`)
  }
  
  const { data: cronJobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: fetchCronJobs,
    refetchInterval: 30000,
    enabled: isAuthenticated,
    retry: 3,
    retryDelay: 1000,
  })

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`

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

  const todaysJobs = useMemo(() => {
    return [...cronJobs]
      .filter(job => job.next_run)
      .sort((a, b) => getTimeFromJob(a).localeCompare(getTimeFromJob(b)))
      .slice(0, 10)
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Scheduled Jobs
          <span className="text-sm font-normal text-dark-400">({cronJobs.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-dark-400 hidden sm:inline">
            <span className="font-mono text-dark-200">{currentTimeStr}</span>
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 rounded-lg transition-colors"
            title="Add Job"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => refetch()}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline bar */}
      {todaysJobs.length > 0 && (
        <div className="mb-4 flex gap-1 overflow-x-auto pb-2 scrollbar-thin">
          {todaysJobs.map((job, idx) => {
            const jobTime = getTimeFromJob(job)
            const isPast = jobTime < currentTimeStr
            const isNext = nextJob && job.name === nextJob.name
            
            return (
              <button
                key={idx}
                onClick={() => setExpandedJob(expandedJob === job.name ? null : job.name)}
                className={`flex-shrink-0 px-2 py-1 rounded text-xs font-mono transition-colors ${
                  isNext 
                    ? 'bg-primary-500/30 text-primary-300 ring-1 ring-primary-500/50' 
                    : isPast 
                      ? 'bg-dark-700 text-dark-500 hover:bg-dark-600' 
                      : 'bg-dark-600 text-dark-300 hover:bg-dark-500'
                }`}
                title={job.name}
              >
                {jobTime}
              </button>
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
        <div className="text-xs text-dark-500">
          Click job to expand
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredJobs.length === 0 ? (
          <div className="text-dark-400 text-center py-4 text-sm">
            No scheduled jobs found
          </div>
        ) : (
          filteredJobs.map((job, index) => {
            const jobTime = getTimeFromJob(job)
            const isPast = jobTime < currentTimeStr
            const isNext = nextJob && job.name === nextJob.name
            
            return (
              <JobRow
                key={job.id || index}
                job={job}
                isExpanded={expandedJob === job.name}
                onToggle={() => setExpandedJob(expandedJob === job.name ? null : job.name)}
                onNavigate={handleJobClick}
                isPast={isPast}
                isNext={isNext}
              />
            )
          })
        )}
      </div>
      
      <div className="mt-3 text-xs text-dark-500 text-center">
        Auto-refreshes every 30s • Actions will connect to OpenClaw API
      </div>
    </div>
  )
}
