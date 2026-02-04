import { api } from './client'

export interface AgentStatus {
  name: string
  status: 'active' | 'idle' | 'error' | 'offline'
  last_seen: string | null
  current_task: string | null
  space_id: string | null
}

export interface CronJobStatus {
  name: string
  status: 'running' | 'success' | 'failed' | 'unknown'
  last_run: string | null
  next_run: string | null
  schedule: string
}

export interface RecentTask {
  id: string
  action: string
  actor_name: string
  actor_type: string
  created_at: string
  card_name: string | null
  space_name: string | null
}

export interface SystemError {
  timestamp: string
  source: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'critical'
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  agent_count: number
  active_agents: number
  cron_count: number
  failed_crons: number
  error_count: number
  timestamp: string
}

export interface DashboardStats {
  agents: AgentStatus[]
  cron_jobs: CronJobStatus[]
  recent_tasks: RecentTask[]
  errors: SystemError[]
  system_health: SystemHealth
}

export const dashboardApi = {
  getStatus: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/status')
    return data
  },
}
