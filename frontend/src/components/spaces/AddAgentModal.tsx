import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Bot, Loader2 } from 'lucide-react'
import { apiClient } from '@/api/client'

interface AddAgentModalProps {
  spaceId: string
  isOpen: boolean
  onClose: () => void
}

interface AgentFormData {
  name: string
  description: string
  model: string
  schedule_type: 'interval' | 'cron' | 'manual'
  schedule_value: string
}

const MODEL_OPTIONS = [
  { value: 'openrouter/moonshotai/kimi-k2.5', label: 'Kimi k2.5 (Recommended)' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'openrouter/auto', label: 'OpenRouter Auto' },
]

const SCHEDULE_PRESETS = [
  { value: '15m', label: 'Every 15 minutes' },
  { value: '30m', label: 'Every 30 minutes' },
  { value: '1h', label: 'Every hour' },
  { value: '0 9 * * *', label: 'Daily at 9:00' },
  { value: '0 18 * * *', label: 'Daily at 18:00' },
  { value: 'custom', label: 'Custom...' },
]

export default function AddAgentModal({ spaceId, isOpen, onClose }: AddAgentModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    model: 'openrouter/moonshotai/kimi-k2.5',
    schedule_type: 'interval',
    schedule_value: '15m',
  })
  const [customSchedule, setCustomSchedule] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const createMutation = useMutation({
    mutationFn: async (data: AgentFormData) => {
      const payload = {
        space_id: spaceId,
        name: data.name,
        description: data.description || null,
        model: data.model,
        schedule_type: data.schedule_type,
        schedule_value: useCustom ? customSchedule : data.schedule_value,
      }
      return apiClient.post('/agents/registry', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', spaceId] })
      onClose()
      setFormData({
        name: '',
        description: '',
        model: 'openrouter/moonshotai/kimi-k2.5',
        schedule_type: 'interval',
        schedule_value: '15m',
      })
    },
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    createMutation.mutate(formData)
  }

  const handleScheduleChange = (value: string) => {
    if (value === 'custom') {
      setUseCustom(true)
    } else {
      setUseCustom(false)
      // Detect if it's a cron expression
      const isCron = value.includes('*') || value.split(' ').length >= 5
      setFormData({
        ...formData,
        schedule_type: isCron ? 'cron' : 'interval',
        schedule_value: value,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-dark-100">Add Sub-Agent</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-dark-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sentinel, Reporter, Coder"
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this agent do?"
              rows={2}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Model
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Schedule
            </label>
            <select
              value={useCustom ? 'custom' : formData.schedule_value}
              onChange={(e) => handleScheduleChange(e.target.value)}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              {SCHEDULE_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {useCustom && (
              <input
                type="text"
                value={customSchedule}
                onChange={(e) => setCustomSchedule(e.target.value)}
                placeholder="e.g., 0 */2 * * * (cron) or 2h (interval)"
                className="w-full mt-2 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            )}
          </div>

          {/* Error */}
          {createMutation.isError && (
            <div className="text-red-400 text-sm">
              Failed to create agent. Please try again.
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-dark-300 hover:text-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
