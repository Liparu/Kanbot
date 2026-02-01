import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  X,
  Clock,
  MapPin,
  AlignLeft,
  ExternalLink,
  CheckSquare,
  Users,
  Columns,
  FolderOpen,
  Tag,
} from 'lucide-react'
import { format } from 'date-fns'
import type { CalendarDisplayEvent } from '@/utils/calendar'

interface EventPopoverProps {
  event: CalendarDisplayEvent
  onClose: () => void
  isGlobalView?: boolean
}

export default function EventPopover({
  event,
  onClose,
  isGlobalView,
}: EventPopoverProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const formatTimeRange = () => {
    if (event.isAllDay) {
      if (event.spanDays > 1) {
        return `${format(event.start, 'MMM d')} - ${format(event.end, 'MMM d')} · ${t('calendar.allDay')}`
      }
      return `${format(event.start, 'EEEE, MMM d')} · ${t('calendar.allDay')}`
    }

    const sameDay = format(event.start, 'yyyy-MM-dd') === format(event.end, 'yyyy-MM-dd')
    if (sameDay) {
      return `${format(event.start, 'EEEE, MMM d')} · ${format(event.start, 'HH:mm')} - ${format(event.end, 'HH:mm')}`
    }
    return `${format(event.start, 'MMM d HH:mm')} - ${format(event.end, 'MMM d HH:mm')}`
  }

  const getDuration = () => {
    if (event.isAllDay) {
      if (event.spanDays > 1) {
        return `${event.spanDays} ${t('calendar.daysLabel')}`
      }
      return t('calendar.allDay')
    }
    const diffMs = event.end.getTime() - event.start.getTime()
    const hours = diffMs / (1000 * 60 * 60)
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`
    }
    return `${hours.toFixed(1)}h`
  }

  const handleViewCard = () => {
    if (event.card && event.spaceId) {
      navigate(`/spaces/${event.spaceId}?card=${event.card.id}`)
      onClose()
    }
  }

  const taskProgress = event.taskCount && event.taskCount > 0 
    ? Math.round(((event.completedTaskCount || 0) / event.taskCount) * 100) 
    : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 rounded-xl w-full max-w-md border border-dark-700 shadow-2xl overflow-hidden"
      >
        {/* Color bar header */}
        <div className="h-2" style={{ backgroundColor: event.color }} />
        
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-white mb-1.5">
                {event.title}
              </h3>
              
              {/* Space and Column info */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-dark-400">
                {isGlobalView && event.spaceName && (
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5" />
                    {event.spaceName}
                  </span>
                )}
                {event.columnName && (
                  <>
                    {isGlobalView && event.spaceName && <span className="text-dark-600">·</span>}
                    <span className="flex items-center gap-1.5">
                      <Columns className="w-3.5 h-3.5" />
                      {event.columnName}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-white transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Time and Duration */}
          <div className="flex items-center gap-3 mb-3 text-dark-200 bg-dark-700/30 rounded-lg p-3">
            <Clock className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">{formatTimeRange()}</div>
              <div className="text-xs text-dark-400 mt-0.5">{getDuration()}</div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-3 mb-3 text-dark-200">
              <MapPin className="w-4 h-4 text-dark-400 flex-shrink-0" />
              <a 
                href={`https://maps.google.com?q=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-primary-400 transition-colors truncate"
              >
                {event.location}
              </a>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3 mb-4 text-dark-200">
              <AlignLeft className="w-4 h-4 text-dark-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-dark-300 line-clamp-4 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Task Progress */}
          {taskProgress !== null && (
            <div className="mb-4 p-3 bg-dark-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm text-dark-300">
                  <CheckSquare className="w-4 h-4" />
                  {t('cards.tasks')}
                </span>
                <span className="text-sm font-medium text-white">
                  {event.completedTaskCount}/{event.taskCount}
                </span>
              </div>
              <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${taskProgress}%` }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: event.color }}
                />
              </div>
              <div className="text-xs text-dark-400 mt-1 text-right">{taskProgress}%</div>
            </div>
          )}

          {/* Assignees */}
          {event.assigneeCount !== undefined && event.assigneeCount > 0 && (
            <div className="flex items-center gap-3 mb-3 text-dark-200">
              <Users className="w-4 h-4 text-dark-400 flex-shrink-0" />
              <span className="text-sm">
                {event.assigneeCount} {event.assigneeCount === 1 ? 'assignee' : 'assignees'}
              </span>
            </div>
          )}

          {/* Tags */}
          {event.tagNames && event.tagNames.length > 0 && (
            <div className="flex items-center gap-3 mb-4 text-dark-200">
              <Tag className="w-4 h-4 text-dark-400 flex-shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {event.tagNames.map((tag, idx) => (
                  <span 
                    key={idx}
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{ backgroundColor: `${event.color}20`, color: event.color }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Multi-day indicator */}
          {event.spanDays > 1 && (
            <div className="mb-4">
              <span 
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: `${event.color}20`, color: event.color }}
              >
                {event.spanDays} {t('calendar.daysLabel')}
              </span>
            </div>
          )}

          {/* View Card Action */}
          {event.card && (
            <div className="pt-4 border-t border-dark-700">
              <button
                onClick={handleViewCard}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                {t('cards.viewDetails')}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
