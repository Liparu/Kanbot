import { format, parse, isValid, parseISO } from 'date-fns'
import type { DateFormat } from '@/stores/settings'

const FORMAT_MAP: Record<DateFormat, string> = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
}

// Time format patterns
const TIME_FORMAT_12H = 'h:mm a'
const TIME_FORMAT_24H = 'HH:mm'

export function formatDate(isoDate: string | undefined | null, dateFormat: DateFormat): string {
  if (!isoDate) return ''
  const date = parse(isoDate, 'yyyy-MM-dd', new Date())
  if (!isValid(date)) return isoDate
  return format(date, FORMAT_MAP[dateFormat])
}

export function parseUserDate(userInput: string, dateFormat: DateFormat): string | null {
  const parsed = parse(userInput, FORMAT_MAP[dateFormat], new Date())
  if (!isValid(parsed)) return null
  return format(parsed, 'yyyy-MM-dd')
}

export function getDateFnsFormat(dateFormat: DateFormat): string {
  return FORMAT_MAP[dateFormat]
}

export function getPlaceholder(dateFormat: DateFormat): string {
  return dateFormat
}

// ============ DateTime Functions ============

/**
 * Check if a datetime string represents an all-day event (time is 00:00:00)
 */
export function isAllDay(dateTimeStr: string | null | undefined): boolean {
  if (!dateTimeStr) return true
  const date = parseISO(dateTimeStr)
  if (!isValid(date)) return true
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
}

/**
 * Format a datetime string for display
 * If all-day, shows only date. If has time, shows date + time.
 */
export function formatDateTime(
  isoDateTime: string | undefined | null,
  dateFormat: DateFormat,
  use24Hour = true
): string {
  if (!isoDateTime) return ''
  
  const date = parseISO(isoDateTime)
  if (!isValid(date)) return isoDateTime
  
  const datePart = format(date, FORMAT_MAP[dateFormat])
  
  if (isAllDay(isoDateTime)) {
    return datePart
  }
  
  const timePart = format(date, use24Hour ? TIME_FORMAT_24H : TIME_FORMAT_12H)
  return `${datePart} ${timePart}`
}

/**
 * Format just the time portion
 */
export function formatTime(
  isoDateTime: string | undefined | null,
  use24Hour = true
): string {
  if (!isoDateTime) return ''
  
  const date = parseISO(isoDateTime)
  if (!isValid(date)) return ''
  
  return format(date, use24Hour ? TIME_FORMAT_24H : TIME_FORMAT_12H)
}

/**
 * Parse datetime from input (datetime-local input format: yyyy-MM-ddTHH:mm)
 */
export function parseDateTimeInput(input: string): Date | null {
  const date = parseISO(input)
  return isValid(date) ? date : null
}

/**
 * Format datetime for input element (datetime-local expects yyyy-MM-ddTHH:mm)
 */
export function toDateTimeInputValue(date: Date | null): string {
  if (!date || !isValid(date)) return ''
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

/**
 * Convert ISO datetime to local datetime string for input
 */
export function isoToLocalInputValue(isoString: string | null): string {
  if (!isoString) return ''
  const date = parseISO(isoString)
  if (!isValid(date)) return ''
  return toDateTimeInputValue(date)
}

/**
 * Create ISO datetime string from date and optional time parts
 * If no time provided, sets to 00:00:00 (all-day)
 */
export function createISODateTime(
  dateStr: string, // yyyy-MM-dd
  timeStr?: string | null // HH:mm or null for all-day
): string {
  if (timeStr) {
    return `${dateStr}T${timeStr}:00`
  }
  return `${dateStr}T00:00:00`
}

/**
 * Extract date part from ISO datetime
 */
export function getDatePart(isoDateTime: string | null): string {
  if (!isoDateTime) return ''
  const date = parseISO(isoDateTime)
  if (!isValid(date)) return ''
  return format(date, 'yyyy-MM-dd')
}

/**
 * Extract time part from ISO datetime
 */
export function getTimePart(isoDateTime: string | null): string | null {
  if (!isoDateTime) return null
  const date = parseISO(isoDateTime)
  if (!isValid(date)) return null
  if (isAllDay(isoDateTime)) return null
  return format(date, 'HH:mm')
}

/**
 * Calculate duration between two datetimes in minutes
 */
export function getDurationMinutes(
  startIso: string | null,
  endIso: string | null
): number | null {
  if (!startIso || !endIso) return null
  
  const start = parseISO(startIso)
  const end = parseISO(endIso)
  
  if (!isValid(start) || !isValid(end)) return null
  
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}
