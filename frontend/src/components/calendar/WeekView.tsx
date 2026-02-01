import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
  differenceInMinutes,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  differenceInDays,
} from 'date-fns'
import { MapPin, CheckSquare, Clock, ChevronDown, ChevronUp, Briefcase } from 'lucide-react'
import { type CalendarDisplayEvent } from '@/utils/calendar'
import type { Card } from '@/types'

interface WeekViewProps {
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
  }>
  onEventClick: (event: CalendarDisplayEvent) => void
  onDayClick: (day: Date) => void
  onCreateEvent: (day: Date, hour?: number) => void
  isGlobalView?: boolean
}

interface MultiDaySegment {
  event: CalendarDisplayEvent
  dayDate: Date
  segmentType: 'start' | 'middle' | 'end' | 'single'
  totalDays: number
  dayIndex: number
}

interface TimedMultiDaySegment {
  event: CalendarDisplayEvent
  dayDate: Date
  segmentType: 'start' | 'middle' | 'end' | 'single'
  totalDays: number
  dayIndex: number
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const SLOT_HEIGHT = 36
const BUSINESS_HOURS_START = 8
const BUSINESS_HOURS_END = 18
const HOVER_DELAY = 80

interface LaneOccupancy {
  startHour: number
  endHour: number
}

export default function WeekView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
  onCreateEvent,
  isGlobalView,
}: WeekViewProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [allDayExpanded, setAllDayExpanded] = useState(true)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      const hour = now.getHours()
      const targetHour = Math.max(0, hour - 2)
      scrollRef.current.scrollTop = targetHour * SLOT_HEIGHT
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [currentDate])

  const { allDaySegments, timedEvents, timedMultiDaySegments } = useMemo(() => {
    const allDay: MultiDaySegment[] = []
    const timed: CalendarDisplayEvent[] = []
    const timedMultiDay: TimedMultiDaySegment[] = []

    events.forEach((event) => {
      const eventStart = event.start
      const eventEnd = event.end || event.start
      
      const isAllDay =
        event.isAllDay ??
        (!eventStart.getHours() && !eventStart.getMinutes() &&
          (!event.end || (!eventEnd.getHours() && !eventEnd.getMinutes())))

      const totalDays = Math.max(1, differenceInDays(endOfDay(eventEnd), startOfDay(eventStart)) + 1)
      
      const processedEvent: CalendarDisplayEvent = {
        ...event,
        end: eventEnd,
        isAllDay,
        spanDays: totalDays,
        dayIndex: 0,
        isFirstDay: true,
        isLastDay: true,
        isContinuation: false,
      }

      if (isAllDay) {
        weekDays.forEach((day) => {
          const dayStart = startOfDay(day)
          const dayEnd = endOfDay(day)
          
          if (isBefore(dayEnd, startOfDay(eventStart)) || isAfter(dayStart, endOfDay(eventEnd))) {
            return
          }
          
          let segmentType: 'start' | 'middle' | 'end' | 'single' = 'single'
          
          if (totalDays === 1) {
            segmentType = 'single'
          } else if (isSameDay(day, eventStart)) {
            segmentType = 'start'
          } else if (isSameDay(day, eventEnd)) {
            segmentType = 'end'
          } else {
            segmentType = 'middle'
          }
          
          const dayIdx = differenceInDays(day, eventStart)
          
          allDay.push({
            event: processedEvent,
            dayDate: day,
            segmentType,
            totalDays,
            dayIndex: dayIdx,
          })
        })
      } else if (totalDays > 1) {
        weekDays.forEach((day) => {
          const dayStart = startOfDay(day)
          const dayEnd = endOfDay(day)
          
          if (isBefore(dayEnd, startOfDay(eventStart)) || isAfter(dayStart, endOfDay(eventEnd))) {
            return
          }
          
          let segmentType: 'start' | 'middle' | 'end' | 'single' = 'single'
          
          if (isSameDay(day, eventStart)) {
            segmentType = 'start'
          } else if (isSameDay(day, eventEnd)) {
            segmentType = 'end'
          } else {
            segmentType = 'middle'
          }
          
          const dayIdx = differenceInDays(day, eventStart)
          
          timedMultiDay.push({
            event: processedEvent,
            dayDate: day,
            segmentType,
            totalDays,
            dayIndex: dayIdx,
          })
        })
      } else {
        timed.push(processedEvent)
      }
    })

    return { allDaySegments: allDay, timedEvents: timed, timedMultiDaySegments: timedMultiDay }
  }, [events, weekDays])

  const getDayAllDaySegments = (day: Date): MultiDaySegment[] => {
    return allDaySegments.filter((seg) => isSameDay(seg.dayDate, day))
  }

  const getDayTimedMultiDaySegments = (day: Date): TimedMultiDaySegment[] => {
    return timedMultiDaySegments.filter((seg) => isSameDay(seg.dayDate, day))
  }

  const checkTimeOverlap = (a: LaneOccupancy, b: LaneOccupancy): boolean => {
    return a.startHour < b.endHour && b.startHour < a.endHour
  }

  const getSegmentTimeRange = (seg: TimedMultiDaySegment): LaneOccupancy => {
    if (seg.segmentType === 'start') {
      return {
        startHour: getHours(seg.event.start) + getMinutes(seg.event.start) / 60,
        endHour: 24
      }
    } else if (seg.segmentType === 'end') {
      return {
        startHour: 0,
        endHour: getHours(seg.event.end) + getMinutes(seg.event.end) / 60
      }
    } else {
      return { startHour: 0, endHour: 24 }
    }
  }

  const multiDayEventLanes = useMemo(() => {
    const lanes: Map<string, number> = new Map()
    const uniqueEvents = [...new Map(
      timedMultiDaySegments.map(s => [s.event.id, s.event])
    ).values()]
    
    uniqueEvents.sort((a, b) => {
      const startDiff = a.start.getTime() - b.start.getTime()
      if (startDiff !== 0) return startDiff
      const durationA = (a.end?.getTime() || a.start.getTime()) - a.start.getTime()
      const durationB = (b.end?.getTime() || b.start.getTime()) - b.start.getTime()
      return durationB - durationA
    })

    const laneOccupancies: Map<number, Array<{ eventId: string, segments: TimedMultiDaySegment[] }>> = new Map()

    uniqueEvents.forEach(event => {
      const eventSegments = timedMultiDaySegments.filter(s => s.event.id === event.id)
      
      let assignedLane = 0
      while (true) {
        const laneEvents = laneOccupancies.get(assignedLane) || []
        let hasConflict = false
        
        for (const existingEvent of laneEvents) {
          for (const existingSeg of existingEvent.segments) {
            for (const newSeg of eventSegments) {
              if (isSameDay(existingSeg.dayDate, newSeg.dayDate)) {
                const existingTime = getSegmentTimeRange(existingSeg)
                const newTime = getSegmentTimeRange(newSeg)
                if (checkTimeOverlap(existingTime, newTime)) {
                  hasConflict = true
                  break
                }
              }
            }
            if (hasConflict) break
          }
          if (hasConflict) break
        }
        
        if (!hasConflict) {
          lanes.set(event.id, assignedLane)
          if (!laneOccupancies.has(assignedLane)) {
            laneOccupancies.set(assignedLane, [])
          }
          laneOccupancies.get(assignedLane)!.push({ eventId: event.id, segments: eventSegments })
          break
        }
        assignedLane++
      }
    })
    
    return lanes
  }, [timedMultiDaySegments])

  const getDayPositionedEvents = (day: Date): { 
    singleDayEvents: Array<{ event: CalendarDisplayEvent, lane: number }>,
    multiDayPositioned: Array<{ segment: TimedMultiDaySegment, lane: number }>,
    totalLanes: number
  } => {
    const singleDayEvents = timedEvents.filter((event) => isSameDay(event.start, day))
    const multiDaySegs = getDayTimedMultiDaySegments(day)
    
    const multiDayWithLanes = multiDaySegs.map(seg => ({
      segment: seg,
      lane: multiDayEventLanes.get(seg.event.id) || 0
    }))

    const laneOccupancies: Map<number, LaneOccupancy[]> = new Map()
    
    multiDayWithLanes.forEach(({ segment, lane }) => {
      const timeRange = getSegmentTimeRange(segment)
      if (!laneOccupancies.has(lane)) {
        laneOccupancies.set(lane, [])
      }
      laneOccupancies.get(lane)!.push(timeRange)
    })

    const sortedSingleDay = [...singleDayEvents].sort((a, b) => 
      a.start.getTime() - b.start.getTime()
    )

    const singleDayWithLanes: Array<{ event: CalendarDisplayEvent, lane: number }> = []

    sortedSingleDay.forEach(event => {
      const eventTime: LaneOccupancy = {
        startHour: getHours(event.start) + getMinutes(event.start) / 60,
        endHour: getHours(event.end) + getMinutes(event.end) / 60
      }
      
      let assignedLane = 0
      while (true) {
        const laneRanges = laneOccupancies.get(assignedLane) || []
        const hasConflict = laneRanges.some(range => checkTimeOverlap(range, eventTime))
        
        if (!hasConflict) {
          singleDayWithLanes.push({ event, lane: assignedLane })
          if (!laneOccupancies.has(assignedLane)) {
            laneOccupancies.set(assignedLane, [])
          }
          laneOccupancies.get(assignedLane)!.push(eventTime)
          break
        }
        assignedLane++
      }
    })
    
    const allLanes = [
      ...multiDayWithLanes.map(m => m.lane),
      ...singleDayWithLanes.map(s => s.lane)
    ]
    const totalLanes = allLanes.length > 0 ? Math.max(...allLanes) + 1 : 1
    
    return { singleDayEvents: singleDayWithLanes, multiDayPositioned: multiDayWithLanes, totalLanes }
  }

  const maxAllDayEventsPerDay = useMemo(() => {
    return Math.max(...weekDays.map(day => getDayAllDaySegments(day).length), 0)
  }, [weekDays, allDaySegments])

  const currentTimePosition = useMemo(() => {
    const hours = getHours(currentTime)
    const minutes = getMinutes(currentTime)
    return (hours + minutes / 60) * SLOT_HEIGHT
  }, [currentTime])

  const currentDayIndex = weekDays.findIndex((day) => isToday(day))
  const isCurrentTimeVisible = currentDayIndex !== -1

  return (
    <div className="flex flex-col h-full overflow-hidden bg-dark-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-dark-700">
        <div className="flex">
          <div className="w-12 sm:w-14 flex-shrink-0" />
          <div className="flex-1 grid grid-cols-7">
            {weekDays.map((day) => {
              const dayIsToday = isToday(day)
              const { singleDayEvents, multiDayPositioned } = getDayPositionedEvents(day)
              const dayAllDay = getDayAllDaySegments(day)
              const middleSegs = getDayTimedMultiDaySegments(day).filter(s => s.segmentType === 'middle')
              const hasEvents = singleDayEvents.length > 0 || multiDayPositioned.length > 0 || dayAllDay.length > 0 || middleSegs.length > 0
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onDayClick(day)}
                  className={`py-2 px-1 text-center border-r border-dark-700 last:border-r-0 transition-all duration-200 ${
                    dayIsToday 
                      ? 'bg-gradient-to-b from-primary-900/30 to-transparent' 
                      : 'hover:bg-dark-800/50'
                  }`}
                >
                  <div className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${
                    dayIsToday ? 'text-primary-400' : 'text-dark-500'
                  }`}>
                    <span className="hidden sm:inline">{format(day, 'EEE')}</span>
                    <span className="sm:hidden">{format(day, 'EEEEE')}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <div
                      className={`text-lg font-semibold transition-all duration-200 ${
                        dayIsToday
                          ? 'w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-600/30'
                          : 'text-dark-100'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    {hasEvents && !dayIsToday && (
                      <div className="w-1 h-1 rounded-full bg-primary-500" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* All-day events section */}
      {maxAllDayEventsPerDay > 0 && (
        <div className="flex-shrink-0 border-b border-dark-700 bg-dark-850">
          <div className="flex">
            <button
              onClick={() => setAllDayExpanded(!allDayExpanded)}
              className="w-12 sm:w-14 flex-shrink-0 border-r border-dark-700 flex items-center justify-center gap-0.5 text-dark-500 hover:text-dark-300 transition-colors py-1"
            >
              <span className="text-[9px] uppercase font-medium hidden sm:inline">{t('calendar.allDay')}</span>
              {allDayExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((day) => {
                const daySegments = getDayAllDaySegments(day)
                const dayIsToday = isToday(day)
                
                return (
                  <div
                    key={day.toISOString()}
                    className={`border-r border-dark-700 last:border-r-0 p-0.5 overflow-hidden transition-all duration-200 ${
                      dayIsToday ? 'bg-primary-900/10' : ''
                    }`}
                    style={{ 
                      minHeight: allDayExpanded ? `${Math.max(28, daySegments.length * 22 + 4)}px` : '28px' 
                    }}
                  >
                    <AnimatePresence>
                      {allDayExpanded && daySegments.map((segment, idx) => (
                        <AllDayEventSegment
                          key={`${segment.event.id}-${day.toISOString()}`}
                          segment={segment}
                          onClick={() => onEventClick(segment.event)}
                          index={idx}
                          isGlobalView={isGlobalView}
                          isHovered={hoveredEventId === `allday-${segment.event.id}`}
                          onMouseEnter={() => handleEventMouseEnter(`allday-${segment.event.id}`)}
                          onMouseLeave={handleEventMouseLeave}
                        />
                      ))}
                    </AnimatePresence>
                    {!allDayExpanded && daySegments.length > 0 && (
                      <div className="text-[10px] text-dark-400 text-center py-0.5">
                        {daySegments.length}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        <div className="flex" style={{ height: `${24 * SLOT_HEIGHT}px` }}>
          {/* Time labels */}
          <div className="w-12 sm:w-14 flex-shrink-0 sticky left-0 bg-dark-900 z-20 border-r border-dark-700">
            {HOURS.map((hour) => {
              const isBusinessHour = hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END
              return (
                <div
                  key={hour}
                  className="relative"
                  style={{ height: `${SLOT_HEIGHT}px` }}
                >
                  <div className={`absolute -top-2 right-1 sm:right-2 text-[10px] font-medium tabular-nums ${
                    isBusinessHour ? 'text-dark-300' : 'text-dark-600'
                  }`}>
                    {format(setHours(setMinutes(new Date(), 0), hour), 'HH:mm')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid grid-cols-7 relative">
            {/* Hour lines */}
            <div className="absolute inset-0 pointer-events-none">
              {HOURS.map((hour) => {
                const isBusinessHour = hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END
                return (
                  <div key={hour} style={{ height: `${SLOT_HEIGHT}px` }}>
                    <div className={`h-full border-b ${
                      isBusinessHour ? 'border-dark-700/60' : 'border-dark-800/40'
                    }`}>
                      <div className="h-1/2 border-b border-dark-800/20 border-dashed" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Current time indicator */}
            {isCurrentTimeVisible && (
              <div
                className="absolute z-30 pointer-events-none"
                style={{ 
                  top: `${currentTimePosition}px`,
                  left: `${(currentDayIndex / 7) * 100}%`,
                  width: `${100 / 7}%`
                }}
              >
                <div className="relative flex items-center">
                  <div className="absolute -left-1 w-2 h-2 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                  <div className="w-full h-0.5 bg-red-500/80" />
                </div>
              </div>
            )}

            {/* Day columns with events */}
            {weekDays.map((day) => {
              const dayIsToday = isToday(day)
              const { singleDayEvents, multiDayPositioned, totalLanes } = getDayPositionedEvents(day)

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r border-dark-700 last:border-r-0 ${
                    dayIsToday ? 'bg-primary-900/5' : ''
                  }`}
                >
                  {/* Clickable time slots */}
                  {HOURS.map((hour) => {
                    const isBusinessHour = hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END
                    return (
                      <button
                        key={hour}
                        className={`w-full transition-colors block group ${
                          isBusinessHour 
                            ? 'hover:bg-primary-600/10' 
                            : 'hover:bg-dark-700/20'
                        }`}
                        style={{ height: `${SLOT_HEIGHT}px` }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onCreateEvent(day, hour)
                        }}
                      />
                    )
                  })}

                  {/* Multi-day segments (start/middle/end - all with consistent lanes) */}
                  {multiDayPositioned.map(({ segment, lane }) => (
                    <TimedMultiDayEventSegment
                      key={`${segment.event.id}-${segment.segmentType}-${segment.dayIndex}`}
                      segment={segment}
                      lane={lane}
                      totalLanes={totalLanes}
                      onClick={() => onEventClick(segment.event)}
                      slotHeight={SLOT_HEIGHT}
                      isGlobalView={isGlobalView}
                      isHovered={hoveredEventId === `timed-${segment.event.id}-${segment.dayIndex}`}
                      onMouseEnter={() => handleEventMouseEnter(`timed-${segment.event.id}-${segment.dayIndex}`)}
                      onMouseLeave={handleEventMouseLeave}
                    />
                  ))}

                  {/* Single-day timed events */}
                  {singleDayEvents.map(({ event, lane }) => (
                    <EventBar
                      key={event.id}
                      event={event}
                      lane={lane}
                      totalLanes={totalLanes}
                      onClick={() => onEventClick(event)}
                      slotHeight={SLOT_HEIGHT}
                      isGlobalView={isGlobalView}
                      isHovered={hoveredEventId === event.id}
                      onMouseEnter={() => handleEventMouseEnter(event.id)}
                      onMouseLeave={handleEventMouseLeave}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface AllDayEventSegmentProps {
  segment: MultiDaySegment
  onClick: () => void
  index: number
  isGlobalView?: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function AllDayEventSegment({ 
  segment, 
  onClick, 
  index, 
  isGlobalView, 
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: AllDayEventSegmentProps) {
  const { event, segmentType, totalDays, dayIndex } = segment
  const isMiddle = segmentType === 'middle'

  if (isMiddle) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: index * 0.02 }}
        className="relative h-[18px] mb-0.5 group cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-sm transition-all duration-200"
          style={{ 
            backgroundColor: event.color,
            opacity: isHovered ? 1 : 0.6,
          }}
        />
        
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-xl px-3 py-2 whitespace-nowrap pointer-events-none"
              style={{ borderLeft: `3px solid ${event.color}` }}
            >
              <div className="text-xs font-medium text-dark-100">{event.title}</div>
              <div className="text-[10px] text-dark-400 mt-0.5">
                Day {dayIndex + 1} of {totalDays}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ delay: index * 0.02 }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative w-full text-left text-[10px] h-[18px] mb-0.5 overflow-hidden transition-all duration-150 ${
        segmentType === 'start' ? 'rounded-l' : ''
      } ${segmentType === 'end' ? 'rounded-r' : ''} ${
        segmentType === 'single' ? 'rounded' : ''
      }`}
      style={{
        backgroundColor: isHovered ? `${event.color}40` : `${event.color}25`,
        borderLeft: segmentType === 'start' || segmentType === 'single' ? `3px solid ${event.color}` : 'none',
        borderRight: segmentType === 'end' || segmentType === 'single' ? `3px solid ${event.color}` : 'none',
        paddingLeft: segmentType === 'start' || segmentType === 'single' ? '4px' : '2px',
        paddingRight: segmentType === 'end' || segmentType === 'single' ? '4px' : '2px',
      }}
    >
      <span 
        className="truncate block leading-[18px] font-medium"
        style={{ color: event.color }}
      >
        {isGlobalView && event.spaceName && (
          <span className="opacity-70">{event.spaceName}: </span>
        )}
        {event.title}
        {segmentType === 'start' && totalDays > 1 && (
          <span className="opacity-50"> →</span>
        )}
        {segmentType === 'end' && totalDays > 1 && (
          <span className="opacity-50">← </span>
        )}
      </span>
    </motion.button>
  )
}

interface EventBarProps {
  event: CalendarDisplayEvent
  lane: number
  totalLanes: number
  onClick: () => void
  slotHeight: number
  isGlobalView?: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function EventBar({ 
  event, 
  lane,
  totalLanes,
  onClick, 
  slotHeight, 
  isGlobalView, 
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: EventBarProps) {
  const startHour = getHours(event.start) + getMinutes(event.start) / 60
  const endHour = getHours(event.end) + getMinutes(event.end) / 60
  const top = startHour * slotHeight
  const height = Math.max((endHour - startHour) * slotHeight, 20)
  const duration = differenceInMinutes(event.end, event.start)
  
  const LANE_SPACING = 8
  const reservedWidth = totalLanes * LANE_SPACING
  const slotWidthPercent = 100 / totalLanes
  const slotWidthPx = reservedWidth / totalLanes
  const contentLeft = `calc(${reservedWidth - lane * slotWidthPx}px + ${lane * slotWidthPercent}%)`
  const contentWidth = `calc(${slotWidthPercent}% - ${slotWidthPx}px)`

  return (
    <div 
      className="absolute" 
      style={{ 
        top: `${top}px`, 
        left: contentLeft,
        width: contentWidth,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`w-full rounded-md overflow-hidden text-left cursor-pointer transition-all duration-150 ${
          isHovered ? 'scale-[1.02] -translate-y-px shadow-lg' : ''
        }`}
        style={{
          height: `${height}px`,
          background: isHovered 
            ? `${event.color}35`
            : `${event.color}20`,
          borderLeft: `3px solid ${event.color}`,
          boxShadow: isHovered 
            ? `0 4px 12px ${event.color}30` 
            : `0 1px 2px ${event.color}15`,
        }}
      >
        <div className="h-full p-1.5 flex flex-col overflow-hidden">
          <div className="flex items-start gap-1 min-w-0">
            {isGlobalView && event.spaceName && (
              <span 
                className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" 
                style={{ backgroundColor: event.color }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div 
                className="font-semibold leading-tight truncate"
                style={{ 
                  color: event.color, 
                  fontSize: '11px',
                }}
              >
                {event.title}
              </div>
            </div>
          </div>
        </div>
      </button>
      
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-50 p-2 rounded-lg shadow-xl border pointer-events-none"
            style={{ 
              backgroundColor: '#1a1a2e',
              borderColor: `${event.color}60`,
              borderLeftWidth: '3px',
              borderLeftColor: event.color,
              top: `${height + 4}px`,
              minWidth: '140px',
            }}
          >
            {isGlobalView && event.spaceName && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium mb-1" style={{ color: event.color }}>
                <Briefcase className="w-3 h-3" />
                <span>{event.spaceName}</span>
              </div>
            )}
            
            <div className="font-semibold text-xs mb-1" style={{ color: event.color }}>
              {event.title}
            </div>
            
            <div 
              className="flex items-center gap-1 text-[10px]"
              style={{ color: event.color }}
            >
              <Clock className="w-3 h-3 flex-shrink-0 opacity-70" />
              <span className="font-medium tabular-nums">
                {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                {duration >= 60 && (
                  <span className="opacity-60 ml-1">
                    ({Math.floor(duration / 60)}h{duration % 60 > 0 ? `${duration % 60}m` : ''})
                  </span>
                )}
              </span>
            </div>

            {event.location && (
              <div 
                className="flex items-center gap-1 text-[10px] mt-1"
                style={{ color: event.color }}
              >
                <MapPin className="w-3 h-3 flex-shrink-0 opacity-70" />
                <span className="truncate opacity-80">{event.location}</span>
              </div>
            )}

            {event.taskCount !== undefined && event.taskCount > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <CheckSquare 
                  className="w-3 h-3 flex-shrink-0 opacity-70" 
                  style={{ color: event.color }} 
                />
                <div className="flex-1 h-1 bg-black/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full"
                    style={{ 
                      backgroundColor: event.color,
                      width: `${((event.completedTaskCount || 0) / event.taskCount) * 100}%`
                    }}
                  />
                </div>
                <span 
                  className="text-[9px] font-medium tabular-nums opacity-70"
                  style={{ color: event.color }}
                >
                  {event.completedTaskCount}/{event.taskCount}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface TimedMultiDayEventSegmentProps {
  segment: TimedMultiDaySegment
  lane: number
  totalLanes: number
  onClick: () => void
  slotHeight: number
  isGlobalView?: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function TimedMultiDayEventSegment({
  segment,
  lane,
  totalLanes,
  onClick,
  slotHeight,
  isGlobalView,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: TimedMultiDayEventSegmentProps) {
  const { event, segmentType, totalDays, dayIndex } = segment
  const duration = differenceInMinutes(event.end, event.start)
  
  const LANE_SPACING = 8
  const reservedWidth = totalLanes * LANE_SPACING
  
  const getPositionAndHeight = () => {
    if (segmentType === 'start') {
      const startHour = getHours(event.start) + getMinutes(event.start) / 60
      const top = startHour * slotHeight
      const height = (24 - startHour) * slotHeight
      return { top, height: Math.max(height, 20) }
    } else if (segmentType === 'end') {
      const endHour = getHours(event.end) + getMinutes(event.end) / 60
      const top = 0
      const height = endHour * slotHeight
      return { top, height: Math.max(height, 20) }
    } else {
      return { top: 0, height: 24 * slotHeight }
    }
  }
  
  const { top, height } = getPositionAndHeight()
  const isMiddle = segmentType === 'middle'

  if (isMiddle) {
    const middleLeft = lane * LANE_SPACING + 2
    return (
      <div
        className="absolute z-20"
        style={{ 
          top: `${top}px`, 
          height: `${height}px`,
          left: `${middleLeft}px`,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="h-full w-1.5 rounded-sm transition-all duration-200 hover:w-2"
          style={{ 
            backgroundColor: event.color,
            opacity: isHovered ? 1 : 0.5,
          }}
        />
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute left-4 top-4 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-xl px-3 py-2 whitespace-nowrap pointer-events-none"
              style={{ borderLeft: `3px solid ${event.color}` }}
            >
              {isGlobalView && event.spaceName && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium mb-1" style={{ color: event.color }}>
                  <Briefcase className="w-3 h-3" />
                  <span>{event.spaceName}</span>
                </div>
              )}
              <div className="text-xs font-medium text-dark-100">{event.title}</div>
              <div className="text-[10px] text-dark-400 mt-0.5">
                Day {dayIndex + 1} of {totalDays}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const slotWidthPercent = 100 / totalLanes
  const slotWidthPx = reservedWidth / totalLanes
  const contentLeft = `calc(${reservedWidth - lane * slotWidthPx}px + ${lane * slotWidthPercent}%)`
  const contentWidth = `calc(${slotWidthPercent}% - ${slotWidthPx}px)`

  return (
    <div 
      className="absolute z-20"
      style={{ 
        top: `${top}px`,
        left: contentLeft,
        width: contentWidth,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`w-full rounded-md overflow-hidden text-left cursor-pointer transition-all duration-150 ${
          isHovered ? 'scale-[1.02] shadow-lg' : ''
        } ${segmentType === 'start' ? 'rounded-b-none' : ''} ${segmentType === 'end' ? 'rounded-t-none' : ''}`}
        style={{
          height: `${height}px`,
          background: isHovered 
            ? `${event.color}35`
            : `${event.color}20`,
          borderLeft: `3px solid ${event.color}`,
          boxShadow: isHovered 
            ? `0 4px 12px ${event.color}30` 
            : `0 1px 2px ${event.color}15`,
        }}
      >
        <div className="h-full p-1.5 flex flex-col overflow-hidden">
          <div className="flex items-start gap-1 min-w-0">
            {isGlobalView && event.spaceName && (
              <span 
                className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" 
                style={{ backgroundColor: event.color }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div 
                className="font-semibold leading-tight truncate"
                style={{ 
                  color: event.color, 
                  fontSize: '11px',
                }}
              >
                {event.title}
                {segmentType === 'start' && <span className="opacity-50 ml-1">→</span>}
                {segmentType === 'end' && <span className="opacity-50 mr-1">←</span>}
              </div>
            </div>
          </div>
        </div>
      </button>
      
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-50 p-2 rounded-lg shadow-xl border pointer-events-none"
            style={{ 
              backgroundColor: '#1a1a2e',
              borderColor: `${event.color}60`,
              borderLeftWidth: '3px',
              borderLeftColor: event.color,
              top: `${height + 4}px`,
              minWidth: '140px',
            }}
          >
            {isGlobalView && event.spaceName && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium mb-1" style={{ color: event.color }}>
                <Briefcase className="w-3 h-3" />
                <span>{event.spaceName}</span>
              </div>
            )}
            
            <div className="font-semibold text-xs mb-1" style={{ color: event.color }}>
              {event.title}
            </div>
            
            <div className="text-[10px] mb-1 opacity-70" style={{ color: event.color }}>
              {segmentType === 'start' ? `Day 1 of ${totalDays} (starts here)` : `Day ${totalDays} of ${totalDays} (ends here)`}
            </div>
            
            <div 
              className="flex items-center gap-1 text-[10px]"
              style={{ color: event.color }}
            >
              <Clock className="w-3 h-3 flex-shrink-0 opacity-70" />
              <span className="font-medium tabular-nums">
                {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                {duration >= 60 && (
                  <span className="opacity-60 ml-1">
                    ({Math.floor(duration / 60)}h{duration % 60 > 0 ? `${duration % 60}m` : ''})
                  </span>
                )}
              </span>
            </div>

            {event.location && (
              <div 
                className="flex items-center gap-1 text-[10px] mt-1"
                style={{ color: event.color }}
              >
                <MapPin className="w-3 h-3 flex-shrink-0 opacity-70" />
                <span className="truncate opacity-80">{event.location}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
