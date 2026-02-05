import { useState, useMemo, useRef, memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { Plus, MapPin, CheckSquare, Users, X, Clock, Briefcase } from 'lucide-react'
import { processEventsForDisplay, type CalendarDisplayEvent } from '@/utils/calendar'
import type { Card } from '@/types'

interface MonthViewProps {
  currentDate: Date
  events: Array<{
    id: string
    title: string
    start: Date
    end?: Date
    color: string
    card: Card
    isAllDay?: boolean
    description?: string
    location?: string
    spaceId?: string
    spaceName?: string
    columnName?: string
    columnId?: string
    taskCount?: number
    completedTaskCount?: number
    assigneeCount?: number
    tagNames?: string[]
  }>
  onEventClick: (event: CalendarDisplayEvent) => void
  onDayClick: (day: Date) => void
  onCreateEvent: (day: Date) => void
  isGlobalView?: boolean
  isLoading?: boolean
}

const MAX_VISIBLE_EVENTS = 3
const HOVER_DELAY = 100

export default function MonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
  onCreateEvent,
  isGlobalView,
}: MonthViewProps) {
  const { t } = useTranslation()
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null)
  const [moreEventsDay, setMoreEventsDay] = useState<Date | null>(null)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleEventMouseEnter = useCallback((eventId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredEventId(eventId)
  }, [])

  const handleEventMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEventId(null)
    }, HOVER_DELAY)
  }, [])

  const processedEvents = useMemo(() => {
    return processEventsForDisplay(
      events.map((e) => ({
        ...e,
        end: e.end || e.start,
        isAllDay: e.isAllDay ?? false,
        isManualEvent: false,
      }))
    )
  }, [events])

  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const weeks: Date[][] = []
    let currentWeekStart = calendarStart
    
    while (currentWeekStart <= calendarEnd) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(addDays(currentWeekStart, i))
      }
      weeks.push(week)
      currentWeekStart = addDays(currentWeekStart, 7)
    }
    
    return { weeks }
  }, [currentDate])

  const getDayEvents = (day: Date): CalendarDisplayEvent[] => {
    return processedEvents.filter((event) => isSameDay(event.start, day))
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-dark-700 bg-dark-800 flex-shrink-0">
        {dayNames.map((day, idx) => (
          <div
            key={day}
            className={`py-2 sm:py-2.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
              idx >= 5 ? 'text-dark-500' : 'text-dark-400'
            }`}
          >
            <span className="hidden sm:inline">{t(`calendar.days.${day.toLowerCase()}`)}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden">
        {calendarData.weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const isCurrentMonth = isSameMonth(day, currentDate)
            const dayIsToday = isToday(day)
            const dayEvents = getDayEvents(day)
            const hasMore = dayEvents.length > MAX_VISIBLE_EVENTS
            const isHovered = hoveredDay && isSameDay(hoveredDay, day)

            return (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`min-h-[80px] sm:min-h-[110px] p-1 sm:p-1.5 border-r border-b border-dark-700 relative group transition-colors duration-150 ${
                  !isCurrentMonth ? 'bg-dark-900/50' : 'bg-dark-800'
                } ${dayIsToday ? 'bg-primary-900/20 ring-1 ring-inset ring-primary-600/30' : ''} ${
                  isHovered && !dayIsToday ? 'bg-dark-750' : ''
                }`}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-1 sm:mb-1.5 relative z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDayClick(day)
                    }}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all hover:scale-110 ${
                      dayIsToday
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/40'
                        : isCurrentMonth
                        ? 'text-dark-200 hover:bg-dark-600'
                        : 'text-dark-500 hover:bg-dark-700'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateEvent(day)
                    }}
                    className={`p-1 rounded-full bg-primary-600/20 hover:bg-primary-600 text-primary-400 hover:text-white transition-all ${
                      isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Events container */}
                <div className="space-y-0.5 relative z-10">
                  {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                    <EventBar
                      key={`${event.id}-${event.dayIndex}`}
                      event={event}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(event)
                      }}
                      isGlobalView={isGlobalView}
                      isHovered={hoveredEventId === `${event.id}-${event.dayIndex}`}
                      onMouseEnter={() => handleEventMouseEnter(`${event.id}-${event.dayIndex}`)}
                      onMouseLeave={handleEventMouseLeave}
                    />
                  ))}
                  
                  {hasMore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMoreEventsDay(day)
                      }}
                      className="w-full text-left px-1.5 py-0.5 text-xs text-primary-400 hover:text-primary-300 hover:bg-primary-600/10 rounded transition-colors font-medium"
                    >
                      +{dayEvents.length - MAX_VISIBLE_EVENTS} {t('common.more')}
                    </button>
                  )}
                </div>

                {dayEvents.length > 0 && !isHovered && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-dark-700/80 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-dark-300">{dayEvents.length}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <AnimatePresence>
        {moreEventsDay && (
          <MoreEventsPopover
            day={moreEventsDay}
            events={getDayEvents(moreEventsDay)}
            onClose={() => setMoreEventsDay(null)}
            onEventClick={(event) => {
              setMoreEventsDay(null)
              onEventClick(event)
            }}
            isGlobalView={isGlobalView}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

interface EventBarProps {
  event: CalendarDisplayEvent & {
    columnName?: string
    taskCount?: number
    completedTaskCount?: number
    assigneeCount?: number
    location?: string
  }
  onClick: (e: React.MouseEvent) => void
  isGlobalView?: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

const EventBar = memo(function EventBar({ 
  event, 
  onClick, 
  isGlobalView, 
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: EventBarProps) {
  const isMultiDay = event.spanDays > 1
  const isMiddleDay = isMultiDay && !event.isFirstDay && !event.isLastDay
  
  const getClipPath = () => {
    if (!isMultiDay) return undefined
    if (event.isFirstDay) {
      return 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
    }
    if (event.isLastDay) {
      return 'polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%)'
    }
    return undefined
  }
  
  const clipPath = getClipPath()
  
  if (isMiddleDay) {
    return (
      <div className="relative">
        <button
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="w-full h-2.5 rounded-none transition-all hover:opacity-100 hover:scale-y-125 origin-center"
          style={{ backgroundColor: `${event.color}50`, opacity: isHovered ? 1 : 0.6 }}
        />
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 z-50 p-2 rounded-lg shadow-xl border -mx-1 pointer-events-none"
              style={{ 
                backgroundColor: '#1a1a2e',
                borderColor: `${event.color}60`,
                borderLeftWidth: '3px',
                borderLeftColor: event.color,
                top: '100%',
                marginTop: '4px',
              }}
            >
              {isGlobalView && event.spaceName && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium mb-1" style={{ color: event.color }}>
                  <Briefcase className="w-3 h-3" />
                  <span>{event.spaceName}</span>
                </div>
              )}
              
              <div className="font-semibold text-xs" style={{ color: event.color }}>
                {event.title}
              </div>
              
              <div className="text-[10px] mt-1 opacity-70" style={{ color: event.color }}>
                Day {event.dayIndex + 1} of {event.spanDays}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
  
  return (
    <div className="relative">
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-50 p-2 rounded-lg shadow-xl border -mx-1 pointer-events-none"
            style={{ 
              backgroundColor: '#1a1a2e',
              borderColor: `${event.color}60`,
              borderLeftWidth: '3px',
              borderLeftColor: event.color,
              top: '100%',
              marginTop: '4px',
            }}
          >
            {isGlobalView && event.spaceName && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium mb-1" style={{ color: event.color }}>
                <Briefcase className="w-3 h-3" />
                <span>{event.spaceName}</span>
              </div>
            )}
            
            <div className="font-semibold text-xs" style={{ color: event.color }}>
              {event.title}
            </div>
            
            {!event.isAllDay && !(event.start.getHours() === 0 && event.start.getMinutes() === 0) && (
              <div className="flex items-center gap-1 text-[10px] mt-1 opacity-80" style={{ color: event.color }}>
                <Clock className="w-3 h-3" />
                <span>{format(event.start, 'HH:mm')}</span>
              </div>
            )}
            
            {event.location && (
              <div className="flex items-center gap-1 text-[10px] mt-1 opacity-70" style={{ color: event.color }}>
                <MapPin className="w-3 h-3" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
            
            {event.taskCount !== undefined && event.taskCount > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <CheckSquare className="w-3 h-3" style={{ color: event.color, opacity: 0.7 }} />
                <div className="flex-1 h-1 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ 
                      backgroundColor: event.color,
                      width: `${((event.completedTaskCount || 0) / event.taskCount) * 100}%`
                    }}
                  />
                </div>
                <span className="text-[9px]" style={{ color: event.color, opacity: 0.7 }}>
                  {event.completedTaskCount}/{event.taskCount}
                </span>
              </div>
            )}
            
            {event.assigneeCount !== undefined && event.assigneeCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] mt-1 opacity-70" style={{ color: event.color }}>
                <Users className="w-3 h-3" />
                <span>{event.assigneeCount} assignee{event.assigneeCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`w-full text-left px-1.5 py-1 text-[11px] transition-all ${
          !isMultiDay ? 'rounded-md' : ''
        } ${isHovered ? 'shadow-md scale-[1.02] -translate-y-px' : ''}`}
        style={{
          backgroundColor: isHovered ? `${event.color}35` : isMultiDay ? `${event.color}50` : `${event.color}20`,
          borderLeft: !event.isContinuation ? `3px solid ${event.color}` : 'none',
          color: event.color,
          clipPath,
          paddingLeft: event.isLastDay ? '12px' : undefined,
        }}
      >
        <div className="flex items-center gap-1 truncate">
          {isGlobalView && event.spaceName && event.isFirstDay && (
            <span 
              className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: event.color }} 
            />
          )}
          
          {!event.isAllDay && event.isFirstDay && !(event.start.getHours() === 0 && event.start.getMinutes() === 0) && (
            <span className="text-[9px] opacity-70 font-medium flex-shrink-0 tabular-nums">
              {format(event.start, 'HH:mm')}
            </span>
          )}
          
          <span className="truncate font-medium">
            {(event.isFirstDay || event.isLastDay) ? event.title : ''}
          </span>
        </div>
      </button>
    </div>
  )
})

interface MoreEventsPopoverProps {
  day: Date
  events: Array<CalendarDisplayEvent & {
    columnName?: string
    taskCount?: number
    completedTaskCount?: number
    assigneeCount?: number
    location?: string
    spaceName?: string
  }>
  onClose: () => void
  onEventClick: (event: CalendarDisplayEvent) => void
  isGlobalView?: boolean
}

function MoreEventsPopover({
  day,
  events,
  onClose,
  onEventClick,
  isGlobalView,
}: MoreEventsPopoverProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 rounded-xl w-full max-w-md border border-dark-600 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-850">
          <div>
            <h3 className="font-semibold text-white text-lg">
              {format(day, 'EEEE')}
            </h3>
            <p className="text-sm text-dark-400">
              {format(day, 'MMMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-full text-dark-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2 bg-dark-850/50 border-b border-dark-700">
          <span className="text-xs text-dark-400">
            {events.length} {events.length === 1 ? t('calendar.event') : t('calendar.events')}
          </span>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
          {events.map((event) => (
            <button
              key={`${event.id}-${event.dayIndex}`}
              onClick={() => onEventClick(event)}
              className="w-full text-left px-3 py-3 rounded-lg hover:bg-dark-700/50 transition-colors group"
              style={{ borderLeft: `3px solid ${event.color}` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: event.color }}
                />
                <div className="flex-1 min-w-0">
                  {isGlobalView && event.spaceName && (
                    <div className="flex items-center gap-1 text-[10px] text-primary-400 mb-0.5">
                      <Briefcase className="w-3 h-3" />
                      <span>{event.spaceName}</span>
                    </div>
                  )}
                  
                  <div 
                    className="font-medium group-hover:brightness-110 transition-all"
                    style={{ color: event.color }}
                  >
                    {event.title}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-dark-400">
                    {event.isAllDay || (event.start.getHours() === 0 && event.start.getMinutes() === 0) ? (
                      <span className="bg-dark-700 px-2 py-0.5 rounded-full text-[10px]">
                        {t('calendar.allDay')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(event.start, 'HH:mm')}
                      </span>
                    )}
                    
                    {event.columnName && (
                      <span className="text-dark-500">• {event.columnName}</span>
                    )}
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-dark-500">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  
                  {event.taskCount !== undefined && event.taskCount > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            backgroundColor: event.color,
                            width: `${((event.completedTaskCount || 0) / event.taskCount) * 100}%`
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-dark-400">
                        {event.completedTaskCount}/{event.taskCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
