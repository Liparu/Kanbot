import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { History, ArrowRight, Plus, Edit2, Trash2, User, Bot, Tag } from 'lucide-react'
import { cardsApi } from '@/api/boards'
import { formatDateTime } from '@/utils/dateFormat'
import { useSettingsStore } from '@/stores/settings'

interface HistoryEntry {
  id: string
  card_id: string
  action: string
  changes: Record<string, unknown>
  actor_type: 'user' | 'agent'
  actor_id: string
  actor_name: string | null
  created_at: string
}

interface CardHistoryProps {
  cardId: string
}

const ACTION_ICONS: Record<string, typeof History> = {
  created: Plus,
  moved: ArrowRight,
  updated: Edit2,
  deleted: Trash2,
  assigned: User,
  tagged: Tag,
}

export default function CardHistory({ cardId }: CardHistoryProps) {
  const { t } = useTranslation()
  const { dateFormat } = useSettingsStore()

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['card', cardId, 'history'],
    queryFn: () => cardsApi.getHistory(cardId),
  })

  if (isLoading) {
    return (
      <div className="text-sm text-dark-400 py-2">
        {t('common.loading') || 'Loading...'}
      </div>
    )
  }

  if (error || !history) {
    return (
      <div className="text-sm text-dark-500 py-2">
        {t('cards.historyError') || 'Could not load history'}
      </div>
    )
  }

  if ((history as HistoryEntry[]).length === 0) {
    return (
      <div className="text-sm text-dark-500 py-2">
        {t('cards.noHistory') || 'No history available'}
      </div>
    )
  }

  const formatAction = (entry: HistoryEntry): string => {
    switch (entry.action) {
      case 'created':
        return t('cards.historyCreated') || 'Created'
      case 'moved':
        return t('cards.historyMoved') || 'Moved'
      case 'updated':
        return t('cards.historyUpdated') || 'Updated'
      case 'assigned':
        return t('cards.historyAssigned') || 'Assigned'
      case 'tagged':
        return t('cards.historyTagged') || 'Tagged'
      case 'comment_added':
        return t('cards.historyCommented') || 'Commented'
      case 'task_added':
        return t('cards.historyTaskAdded') || 'Task added'
      case 'task_completed':
        return t('cards.historyTaskCompleted') || 'Task completed'
      default:
        return entry.action
    }
  }

  const formatChanges = (entry: HistoryEntry): string | null => {
    const { changes, action } = entry
    if (!changes || Object.keys(changes).length === 0) return null

    switch (action) {
      case 'moved':
        return `${changes.from_column_name || '?'} → ${changes.to_column_name || '?'}`
      case 'updated':
        const fields = Object.keys(changes)
          .filter(k => !k.includes('_id') && k !== 'updated_at')
          .join(', ')
        return fields || null
      case 'created':
        return changes.name as string || null
      default:
        return null
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
        <History className="w-4 h-4" />
        {t('cards.history') || 'History'}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {(history as HistoryEntry[]).slice(0, 20).map((entry) => {
          const Icon = ACTION_ICONS[entry.action] || History
          const changesText = formatChanges(entry)

          return (
            <div
              key={entry.id}
              className="flex items-start gap-2 p-2 bg-dark-700/50 rounded-lg text-xs"
            >
              <div className="mt-0.5">
                <Icon className="w-3 h-3 text-dark-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-dark-300">
                  {entry.actor_type === 'agent' ? (
                    <Bot className="w-3 h-3 text-primary-400" />
                  ) : (
                    <User className="w-3 h-3 text-dark-400" />
                  )}
                  <span className="font-medium truncate">
                    {entry.actor_name || 'Unknown'}
                  </span>
                  <span className="text-dark-500">•</span>
                  <span className="text-dark-400">{formatAction(entry)}</span>
                </div>
                {changesText && (
                  <div className="text-dark-500 truncate mt-0.5">
                    {changesText}
                  </div>
                )}
              </div>
              <div className="text-dark-500 whitespace-nowrap">
                {formatDateTime(entry.created_at, dateFormat)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
