import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Bot, Loader2 } from 'lucide-react'
import api from '@/api/client'

interface AddAgentModalProps {
  spaceId: string
  isOpen: boolean
  onClose: () => void
}

const MODEL_OPTIONS = [
  { value: 'openrouter/moonshotai/kimi-k2.5', label: 'Kimi k2.5 (Recommended)' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'openrouter/auto', label: 'OpenRouter Auto' },
]

const SCHEDULE_PRESETS = [
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 */4 * * *', label: 'Every 4 hours' },
  { value: '0 9 * * *', label: 'Daily at 9:00' },
  { value: '0 9 * * 1-5', label: 'Weekdays at 9:00' },
]

export default function AddAgentModal({ spaceId, isOpen, onClose }: AddAgentModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('openrouter/moonshotai/kimi-k2.5')
  const [scheduleValue, setScheduleValue] = useState('*/15 * * * *')
  const [instructions, setInstructions] = useState('')

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string
      description: string | null
      model: string
      schedule_type: string
      schedule_value: string
      space_id: string
      instructions: string
    }) => {
      return api.post('/agents/registry', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', spaceId] })
      // Reset form
      setName('')
      setDescription('')
      setModel('openrouter/moonshotai/kimi-k2.5')
      setScheduleValue('*/15 * * * *')
      setInstructions('')
      onClose()
    },
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      model,
      schedule_type: 'cron',
      schedule_value: scheduleValue,
      space_id: spaceId,
      instructions: instructions.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700 sticky top-0 bg-dark-800">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-dark-100">Add New Agent</h2>
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
              placeholder="e.g., Research Agent"
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this agent do?"
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
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
            <select
              value={scheduleValue}
              onChange={(e) => setScheduleValue(e.target.value)}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none mb-2"
            >
              {SCHEDULE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={scheduleValue}
              onChange={(e) => setScheduleValue(e.target.value)}
              placeholder="Custom cron: 0 9 * * *"
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none font-mono text-sm"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="What should this agent do on each run? Be specific about tasks, data sources, and reporting format."
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
            />
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
              disabled={createMutation.isPending || !name.trim()}
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
