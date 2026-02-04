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

/**
 * Parse an ISO datetime string treating it as local wall-clock time.
 * This strips any timezone info (Z, +00:00, etc.) and parses the datetime
 * as local time to avoid UTC conversion shifts.
 * 
 * Examples:
 *   "2026-02-04T14:00:00" -> local Date at 14:00
 *   "2026-02-04T14:00:00Z" -> local Date at 14:00 (NOT 15:00)
 *   "2026-02-04T14:00:00+00:00" -> local Date at 14:00 (NOT 15:00)
 */
export function parseISOLocal(dateTimeStr: string): Date {
  // Strip timezone info if present (Z, +00:00, -05:00, etc.)
  // Match patterns like: 2026-02-04T14:00:00Z or 2026-02-04T14:00:00+00:00 or 2026-02-04T14:00:00.000Z
  // Note: (\.\d{1,3})? matches optional milliseconds (must start with dot)
  const cleaned = dateTimeStr.replace(/(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})$/, '')
  
  // Parse the cleaned string manually to avoid timezone issues
  // Format: yyyy-MM-ddTHH:mm:ss or yyyy-MM-ddTHH:mm:ss.SSS
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!match) {
    // Fallback: try parseISO but this may cause timezone shifts
    // This should rarely happen with valid ISO strings
    return parseISO(cleaned)
  }
  
  const [, year, month, day, hour, minute, second] = match
  // Create date using local components - month is 0-indexed in Date constructor
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  )
}

/**
 * Parse a datetime string without timezone shifts.
 * Our ISO strings are stored as 'yyyy-MM-ddTHH:mm:ss' without timezone info,
 * representing local wall-clock time. We parse them to avoid UTC shifts.
 * @deprecated Use parseISOLocal instead
 */
function parseLocalDateTime(dateTimeStr: string): Date {
  return parseISOLocal(dateTimeStr)
}

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
 * Uses local parsing to avoid timezone shifts.
 */
export function isAllDay(dateTimeStr: string | null | undefined): boolean {
  if (!dateTimeStr) return true
  // Check the raw string first to avoid parsing issues
  if (dateTimeStr.match(/T00:00:00$/)) return true
  
  const date = parseLocalDateTime(dateTimeStr)
  if (!isValid(date)) return true
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
}

/**
 * Format a datetime string for display
 * If all-day, shows only date. If has time, shows date + time.
 * Uses local parsing to avoid timezone shifts.
 */
export function formatDateTime(
  isoDateTime: string | undefined | null,
  dateFormat: DateFormat,
  use24Hour = true
): string {
  if (!isoDateTime) return ''
  
  const date = parseLocalDateTime(isoDateTime)
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
 * Uses local parsing to avoid timezone shifts.
 */
export function formatTime(
  isoDateTime: string | undefined | null,
  use24Hour = true
): string {
  if (!isoDateTime) return ''
  
  const date = parseLocalDateTime(isoDateTime)
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
  const date = parseISOLocal(isoString)
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
 * Convert a Date object to local ISO string format (yyyy-MM-ddTHH:mm:ss)
 * This preserves local wall-clock time instead of converting to UTC.
 * Use this instead of .toISOString() to avoid timezone shifts.
 */
export function dateToLocalISOString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

/**
 * Extract date part from ISO datetime
 * Uses local parsing to avoid timezone shifts.
 */
export function getDatePart(isoDateTime: string | null): string {
  if (!isoDateTime) return ''
  const date = parseLocalDateTime(isoDateTime)
  if (!isValid(date)) return ''
  return format(date, 'yyyy-MM-dd')
}

/**
 * Extract time part from ISO datetime
 * Uses local parsing to avoid timezone shifts.
 */
export function getTimePart(isoDateTime: string | null): string | null {
  if (!isoDateTime) return null
  if (isAllDay(isoDateTime)) return null
  const date = parseLocalDateTime(isoDateTime)
  if (!isValid(date)) return null
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

  const start = parseISOLocal(startIso)
  const end = parseISOLocal(endIso)

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
