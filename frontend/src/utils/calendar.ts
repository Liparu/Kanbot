import { differenceInDays, startOfDay, isSameDay, addDays, format } from 'date-fns'
import type { Card } from '@/types'

export interface CalendarDisplayEvent {
  id: string
  title: string
  start: Date
  end: Date
  isAllDay: boolean
  color: string
  card: Card
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
  
  // Multi-day rendering properties
  spanDays: number
  dayIndex: number
  isFirstDay: boolean
  isLastDay: boolean
  isContinuation: boolean
}

export interface ProcessedDayEvents {
  date: Date
  allDayEvents: CalendarDisplayEvent[]
  timedEvents: CalendarDisplayEvent[]
  multiDaySpans: CalendarDisplayEvent[]  // Events that span into this day
}

/**
 * Process events for display in calendar
 * Expands multi-day events into segments for each day they span
 */
export function processEventsForDisplay(
  events: Array<{
    id: string
    title: string
    start: Date
    end?: Date
    color: string
    isAllDay: boolean
    card: Card
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
    isManualEvent?: boolean
  }>
): CalendarDisplayEvent[] {
  const processedEvents: CalendarDisplayEvent[] = []
  
  events.forEach((event) => {
    const endDate = event.end || event.start
    const daysSpan = Math.max(1, differenceInDays(startOfDay(endDate), startOfDay(event.start)) + 1)
    
    // Create a segment for EACH day the event spans
    for (let dayIdx = 0; dayIdx < daysSpan; dayIdx++) {
      const segmentDay = addDays(startOfDay(event.start), dayIdx)
      const isFirst = dayIdx === 0
      const isLast = dayIdx === daysSpan - 1
      
      // Preserve original start time for the first day, use midnight for continuation days
      const segmentStart = isFirst ? event.start : segmentDay
      
      processedEvents.push({
        ...event,
        start: segmentStart,
        end: endDate,
        spanDays: daysSpan,
        dayIndex: dayIdx,
        isFirstDay: isFirst,
        isLastDay: isLast,
        isContinuation: !isFirst,
      })
    }
  })
  
  return processedEvents
}

/**
 * Group events by day for month view
 */
export function groupEventsByDay(
  events: CalendarDisplayEvent[],
  days: Date[]
): Map<string, ProcessedDayEvents> {
  const grouped = new Map<string, ProcessedDayEvents>()
  
  // Initialize all days
  days.forEach((day) => {
    const key = format(day, 'yyyy-MM-dd')
    grouped.set(key, {
      date: day,
      allDayEvents: [],
      timedEvents: [],
      multiDaySpans: [],
    })
  })
  
  // Group events by day
  events.forEach((event) => {
    const dayKey = format(startOfDay(event.start), 'yyyy-MM-dd')
    const dayData = grouped.get(dayKey)
    
    if (dayData) {
      if (event.isAllDay || event.spanDays > 1) {
        dayData.allDayEvents.push(event)
        if (event.spanDays > 1 && !event.isFirstDay) {
          dayData.multiDaySpans.push(event)
        }
      } else {
        dayData.timedEvents.push(event)
      }
    }
  })
  
  return grouped
}

/**
 * Sort events for display within a day
 * All-day first, then by start time
 */
export function sortDayEvents(events: CalendarDisplayEvent[]): CalendarDisplayEvent[] {
  return events.sort((a, b) => {
    // All-day events come first
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    
    // Then sort by start time
    return a.start.getTime() - b.start.getTime()
  })
}

/**
 * Get events for a specific week
 */
export function getEventsForWeek(
  events: CalendarDisplayEvent[],
  weekStart: Date
): CalendarDisplayEvent[] {
  const weekEnd = addDays(weekStart, 7)
  
  return events.filter((event) => {
    // Event starts within the week
    if (event.start >= weekStart && event.start < weekEnd) return true
    // Event ends within the week
    if (event.end >= weekStart && event.end < weekEnd) return true
    // Event spans the entire week
    if (event.start < weekStart && event.end >= weekEnd) return true
    return false
  })
}

/**
 * Position timed events for week view
 * Handles overlapping events by calculating horizontal offsets
 */
export interface PositionedEvent extends CalendarDisplayEvent {
  top: number      // Percentage from top (0-100)
  height: number   // Percentage height (0-100)
  left: number     // Percentage from left (0-100)
  width: number    // Percentage width (0-100)
  column: number   // Column index for overlapping events
  totalColumns: number // Total columns needed for this time slot
}

export function positionTimedEvents(
  events: CalendarDisplayEvent[],
  dayStartHour = 0,
  dayEndHour = 24
): PositionedEvent[] {
  const minutesInDay = (dayEndHour - dayStartHour) * 60
  
  // Group events that overlap
  const columns: CalendarDisplayEvent[][] = []
  
  events.forEach((event) => {
    if (event.isAllDay) return
    
    // Find a column that doesn't conflict with this event
    let placed = false
    for (const column of columns) {
      const lastEvent = column[column.length - 1]
      if (lastEvent.end.getTime() <= event.start.getTime()) {
        column.push(event)
        placed = true
        break
      }
    }
    
    if (!placed) {
      columns.push([event])
    }
  })
  
  const totalColumns = columns.length || 1
  const positioned: PositionedEvent[] = []
  
  columns.forEach((column, colIndex) => {
    column.forEach((event) => {
      const startMinutes = (event.start.getHours() - dayStartHour) * 60 + event.start.getMinutes()
      const endMinutes = (event.end.getHours() - dayStartHour) * 60 + event.end.getMinutes()
      
      const top = (startMinutes / minutesInDay) * 100
      const height = ((endMinutes - startMinutes) / minutesInDay) * 100
      
      positioned.push({
        ...event,
        top: Math.max(0, top),
        height: Math.min(100 - top, height),
        left: (colIndex / totalColumns) * 100,
        width: (1 / totalColumns) * 100,
        column: colIndex,
        totalColumns,
      })
    })
  })
  
  return positioned
}

/**
 * Format event time range for display
 */
export function formatEventTimeRange(
  start: Date,
  end: Date,
  isAllDay: boolean,
  use24Hour = true
): string {
  if (isAllDay) {
    if (isSameDay(start, end)) {
      return 'All day'
    }
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
  }
  
  const timeFormat = use24Hour ? 'HH:mm' : 'h:mm a'
  
  if (isSameDay(start, end)) {
    return `${format(start, timeFormat)} - ${format(end, timeFormat)}`
  }
  
  return `${format(start, 'MMM d')} ${format(start, timeFormat)} - ${format(end, 'MMM d')} ${format(end, timeFormat)}`
}

/**
 * Check if an event should be visible on a specific day
 */
export function isEventVisibleOnDay(event: CalendarDisplayEvent, day: Date): boolean {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  
  return (
    (event.start >= dayStart && event.start < dayEnd) ||
    (event.end > dayStart && event.end <= dayEnd) ||
    (event.start <= dayStart && event.end >= dayEnd)
  )
}

/**
 * Calculate week rows for month view with event positioning
 * This handles the complex layout where multi-day events need to be positioned
 * across week boundaries
 */
export interface WeekRow {
  days: Date[]
  events: CalendarDisplayEvent[]
  rowHeight: number
}

export function calculateMonthWeeks(
  monthStart: Date,
  monthEnd: Date,
  events: CalendarDisplayEvent[]
): WeekRow[] {
  const weeks: WeekRow[] = []
  let currentWeekStart = monthStart
  
  while (currentWeekStart <= monthEnd) {
    const weekDays: Date[] = []
    for (let i = 0; i < 7; i++) {
      weekDays.push(addDays(currentWeekStart, i))
    }
    
    // Get events that appear in this week
    const weekEvents = events.filter((event) => {
      return weekDays.some((day) => isEventVisibleOnDay(event, day))
    })
    
    // Group by event ID to avoid duplicates from multi-day spans
    const uniqueEvents = Array.from(
      new Map(weekEvents.map((e) => [e.id, e])).values()
    )
    
    weeks.push({
      days: weekDays,
      events: uniqueEvents,
      rowHeight: Math.max(100, 40 + uniqueEvents.filter((e) => e.isAllDay || e.spanDays > 1).length * 28),
    })
    
    currentWeekStart = addDays(currentWeekStart, 7)
  }
  
  return weeks
}
