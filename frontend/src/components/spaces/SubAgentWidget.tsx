import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Plus, Settings, Trash2, FileText, CheckCircle, AlertCircle, Clock, Activity, RefreshCw, Loader2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import EditAgentModal from './EditAgentModal'

interface AgentFromAPI {
  id: string
  space_id: string
  name: string
  description: string | null
  model: string
  schedule_type: string | null
  schedule_value: string | null
  enabled: boolean
  status: 'healthy' | 'warning' | 'error'
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  run_count_24h: number
  error_count_24h: number
}

interface SubAgent {
  id: string
  name: string
  model: string
  status: 'healthy' | 'warning' | 'error' | 'offline'
  lastRun: string | null
  nextRun: string | null
  runsToday: number
  schedule: string
  enabled: boolean
}

// Transform API response to component format
const transformAgent = (agent: AgentFromAPI): SubAgent => ({
  id: agent.id,
  name: agent.name,
  model: agent.model.split('/').pop() || agent.model, // Show just model name
  status: agent.enabled ? agent.status : 'offline',
  lastRun: agent.last_run_at,
  nextRun: agent.next_run_at,
  runsToday: agent.run_count_24h,
  schedule: agent.schedule_value || 'Manual',
  enabled: agent.enabled,
})

interface SubAgentWidgetProps {
  spaceId: string
  className?: string
  onAddAgent?: () => void
}

export default function SubAgentWidget({ spaceId, className = '', onAddAgent }: SubAgentWidgetProps) {
  const queryClient = useQueryClient()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null)
  const [editingAgent, setEditingAgent] = useState<AgentFromAPI | null>(null)

  // Fetch agents from API
  const { data: agentsData, isLoading, refetch } = useQuery({
    queryKey: ['agents', spaceId],
    queryFn: async () => {
      const response = await apiClient.get<AgentFromAPI[]>(`/agents/registry?space_id=${spaceId}`)
      return response.data
    },
    refetchInterval: 30000,
    enabled: !!spaceId,
  })

  const rawAgents = agentsData || []
  const agents = rawAgents.map(transformAgent)
  
  const handleEdit = (agentId: string) => {
    const agent = rawAgents.find(a => a.id === agentId)
    if (agent) setEditingAgent(agent)
  }

  // Delete agent mutation
  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiClient.delete(`/agents/registry/${agentId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', spaceId] })
      setDeletingAgent(null)
      setSelectedAgent(null)
    },
  })

  const handleDelete = (agentId: string, agentName: string) => {
    if (deletingAgent === agentId) {
      // Confirm delete
      deleteMutation.mutate(agentId)
    } else {
      // First click - ask for confirmation
      setDeletingAgent(agentId)
    }
  }

  const getStatusIcon = (status: SubAgent['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: SubAgent['status']) => {
    switch (status) {
      case 'healthy':
        return 'border-green-500/30 bg-green-900/10'
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-900/10'
      case 'error':
        return 'border-red-500/30 bg-red-900/10'
      default:
        return 'border-dark-600 bg-dark-800'
    }
  }

  const formatTimeAgo = (isoString: string | null) => {
    if (!isoString) return 'Never'
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const formatTimeUntil = (isoString: string | null) => {
    if (!isoString) return 'Not scheduled'
    const diff = new Date(isoString).getTime() - Date.now()
    if (diff < 0) return 'Overdue'
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Now'
    if (mins < 60) return `in ${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `in ${hours}h`
    return `in ${Math.floor(hours / 24)}d`
  }

  const totalRunsToday = agents.reduce((sum, a) => sum + a.runsToday, 0)

  return (
    <div className={`bg-dark-800 rounded-lg border border-dark-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold text-dark-100">Sub-Agents</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1 text-dark-400 hover:text-dark-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onAddAgent}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 hover:bg-primary-500 text-white rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Agent
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-sm text-dark-400">
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4" />
          <span>{totalRunsToday} runs today</span>
        </div>
        <div className="flex items-center gap-1">
          <Bot className="w-4 h-4" />
          <span>{agents.length} agents</span>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && agents.length === 0 && (
        <div className="text-center text-dark-400 py-4">Loading agents...</div>
      )}

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`p-3 rounded-lg border transition-colors cursor-pointer hover:border-primary-500/50 ${getStatusColor(agent.status)}`}
            onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-dark-100">{agent.name}</div>
                <div className="text-xs text-dark-400">{agent.model}</div>
              </div>
              {getStatusIcon(agent.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-dark-500">Last run</div>
                <div className="text-dark-300">{formatTimeAgo(agent.lastRun)}</div>
              </div>
              <div>
                <div className="text-dark-500">Next run</div>
                <div className="text-dark-300">{formatTimeUntil(agent.nextRun)}</div>
              </div>
            </div>

            {selectedAgent === agent.id && (
              <div className="mt-3 pt-3 border-t border-dark-600 flex gap-2">
                <button className="flex items-center gap-1 px-2 py-1 text-xs bg-dark-700 hover:bg-dark-600 text-dark-300 rounded transition-colors">
                  <FileText className="w-3 h-3" />
                  Logs
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEdit(agent.id)
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-dark-700 hover:bg-dark-600 text-dark-300 rounded transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Edit
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(agent.id, agent.name)
                  }}
                  disabled={deleteMutation.isPending}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    deletingAgent === agent.id 
                      ? 'bg-red-600 hover:bg-red-500 text-white' 
                      : 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                  }`}
                >
                  {deleteMutation.isPending && deletingAgent === agent.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  {deletingAgent === agent.id ? 'Confirm?' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add agent placeholder */}
        <button
          onClick={onAddAgent}
          className="p-3 rounded-lg border-2 border-dashed border-dark-600 hover:border-primary-500/50 text-dark-400 hover:text-dark-300 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add Agent</span>
        </button>
      </div>

      {/* Edit Agent Modal */}
      <EditAgentModal
        agent={editingAgent}
        spaceId={spaceId}
        isOpen={!!editingAgent}
        onClose={() => setEditingAgent(null)}
      />
    </div>
  )
}
