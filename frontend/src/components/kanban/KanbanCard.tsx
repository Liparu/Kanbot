import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Card } from '@/types'

interface KanbanCardProps {
  card: Card
  isDragging?: boolean
  onClick?: () => void
  onToggleTask?: (taskId: string, completed: boolean) => void
}

export default function KanbanCard({ card, isDragging, onClick, onToggleTask }: KanbanCardProps) {
  const { t } = useTranslation()
  const [tasksExpanded, setTasksExpanded] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id, data: { type: 'card', columnId: card.column_id, cardId: card.id } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const tagColors = card.tags?.map(t => t.tag.color).filter(Boolean) || []
  const hasMultipleTags = tagColors.length > 1
  const backgroundColor = hasMultipleTags
    ? `linear-gradient(90deg, ${tagColors.map((c, i) => `${c}20 ${(i / tagColors.length) * 100}%`).join(', ')})`
    : tagColors.length === 1
      ? `${tagColors[0]}20`
      : undefined
  const borderColor = tagColors[0] || 'transparent'

  const hasTasks = card.task_counter > 0
  const hasAssignees = card.assignees?.length > 0
  const tasksPreview = card.tasks?.slice(0, 5) || []
  const hiddenTasksCount = (card.tasks?.length || 0) - tasksPreview.length

  const handleClick = (_e: React.MouseEvent) => {
    if (!isSortableDragging && onClick) {
      onClick()
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`bg-dark-700 rounded-lg p-3 cursor-grab active:cursor-grabbing border-l-4 hover:bg-dark-650 transition-colors relative ${
        isDragging || isSortableDragging ? 'opacity-50 shadow-lg' : ''
      }`}
      style={{
        ...style,
        background: backgroundColor || undefined,
        borderLeftColor: borderColor,
      }}
    >
      {hasAssignees && (
        <div className="absolute top-2 right-2 flex -space-x-1.5">
          {card.assignees.slice(0, 3).map((user) => (
            <div key={user.id} className="relative group">
              <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center text-[10px] text-white border border-dark-700">
                {user.username[0].toUpperCase()}
              </div>
              <div className="absolute top-6 right-0 bg-dark-800 border border-dark-600 text-xs text-dark-100 rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-30 shadow-lg">
                {user.username}
              </div>
            </div>
          ))}
          {card.assignees.length > 3 && (
            <div className="w-5 h-5 bg-dark-600 rounded-full flex items-center justify-center text-[10px] text-dark-300 border border-dark-700">
              +{card.assignees.length - 3}
            </div>
          )}
        </div>
      )}

      <h4 className={`text-sm font-medium text-dark-100 mb-2 ${hasAssignees ? 'pr-16' : ''}`}>{card.name}</h4>

      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${tag.color}30`,
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {hasTasks && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (tasksPreview.length > 0) {
              setTasksExpanded(!tasksExpanded)
            }
          }}
          className="flex items-center gap-1 text-xs text-dark-400 hover:text-dark-200 transition-colors"
        >
          <CheckSquare className="w-3 h-3" />
          <span>{card.task_completed_counter}/{card.task_counter}</span>
          {tasksPreview.length > 0 && (
            <span className="ml-1">
              {tasksExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          )}
        </button>
      )}

      <AnimatePresence>
        {tasksExpanded && tasksPreview.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1">
              {tasksPreview.map((task) => (
                <button
                  key={task.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleTask?.(task.id, !task.completed)
                  }}
                  className={`w-full flex items-center gap-2 text-xs px-2 py-1 rounded bg-dark-800/60 hover:bg-dark-800 ${
                    task.completed ? 'text-dark-500 line-through' : 'text-dark-200'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                      task.completed ? 'bg-primary-600 border-primary-600' : 'border-dark-500'
                    }`}
                  >
                    {task.completed && <span className="block w-1.5 h-1.5 bg-white rounded-sm" />}
                  </span>
                  <span className="truncate text-left">{task.text}</span>
                </button>
              ))}
              {hiddenTasksCount > 0 && (
                <div className="text-xs text-dark-500 px-2 py-1 italic">
                  {t('cards.tasksMore', { count: hiddenTasksCount })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
