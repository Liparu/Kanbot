import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Bot, Loader2 } from 'lucide-react'
import { apiClient } from '@/api/client'

interface Agent {
  id: string
  name: string
  description: string | null
  model: string
  schedule_type: string | null
  schedule_value: string | null
  enabled: boolean
}

interface EditAgentModalProps {
  agent: Agent | null
  spaceId: string
  isOpen: boolean
  onClose: () => void
}

const MODEL_OPTIONS = [
  { value: 'openrouter/moonshotai/kimi-k2.5', label: 'Kimi k2.5 (Recommended)' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'openrouter/auto', label: 'OpenRouter Auto' },
]

export default function EditAgentModal({ agent, spaceId, isOpen, onClose }: EditAgentModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('openrouter/moonshotai/kimi-k2.5')
  const [scheduleValue, setScheduleValue] = useState('')
  const [enabled, setEnabled] = useState(true)

  // Populate form when agent changes
  useEffect(() => {
    if (agent) {
      setName(agent.name)
      setDescription(agent.description || '')
      setModel(agent.model)
      setScheduleValue(agent.schedule_value || '')
      setEnabled(agent.enabled)
    }
  }, [agent])

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Agent>) => {
      return apiClient.patch(`/agents/registry/${agent?.id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', spaceId] })
      onClose()
    },
  })

  if (!isOpen || !agent) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    const isCron = scheduleValue.includes('*') || scheduleValue.split(' ').length >= 5
    
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      model,
      schedule_type: isCron ? 'cron' : 'interval',
      schedule_value: scheduleValue || null,
      enabled,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-dark-100">Edit Agent</h2>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
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
            <input
              type="text"
              value={scheduleValue}
              onChange={(e) => setScheduleValue(e.target.value)}
              placeholder="e.g., 15m, 1h, or 0 9 * * *"
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                enabled ? 'bg-primary-600' : 'bg-dark-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
            <span className="text-sm text-dark-300">
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Error */}
          {updateMutation.isError && (
            <div className="text-red-400 text-sm">
              Failed to update agent. Please try again.
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
              disabled={updateMutation.isPending || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
