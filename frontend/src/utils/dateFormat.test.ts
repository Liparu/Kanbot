import { describe, it, expect } from 'vitest'
import {
  createISODateTime,
  getDatePart,
  getTimePart,
  isAllDay,
  formatTime,
  dateToLocalISOString,
  parseISOLocal
} from './dateFormat'

describe('dateFormat timezone handling', () => {
  describe('createISODateTime', () => {
    it('should create ISO datetime without timezone offset', () => {
      const result = createISODateTime('2026-02-04', '14:30')
      // Should be exactly this string, not adjusted for timezone
      expect(result).toBe('2026-02-04T14:30:00')
    })

    it('should create all-day ISO datetime when time is null', () => {
      const result = createISODateTime('2026-02-04', null)
      expect(result).toBe('2026-02-04T00:00:00')
    })
  })

  describe('getTimePart', () => {
    it('should extract time correctly from ISO string', () => {
      const result = getTimePart('2026-02-04T14:30:00')
      expect(result).toBe('14:30')
    })

    it('should return null for all-day event', () => {
      const result = getTimePart('2026-02-04T00:00:00')
      expect(result).toBeNull()
    })
  })

  describe('getDatePart', () => {
    it('should extract date correctly from ISO string', () => {
      const result = getDatePart('2026-02-04T14:30:00')
      expect(result).toBe('2026-02-04')
    })
  })

  describe('isAllDay', () => {
    it('should return true for midnight time', () => {
      const result = isAllDay('2026-02-04T00:00:00')
      expect(result).toBe(true)
    })

    it('should return false for non-midnight time', () => {
      const result = isAllDay('2026-02-04T14:30:00')
      expect(result).toBe(false)
    })
  })

  describe('formatTime', () => {
    it('should format time correctly without timezone shift', () => {
      const result = formatTime('2026-02-04T14:30:00')
      expect(result).toBe('14:30')
    })
  })

  describe('Bug reproduction: Time selector +1 hour', () => {
    it('should preserve selected time without adding hour', () => {
      // User selects 14:00 in the time picker
      const selectedTime = '14:00'
      const dateStr = '2026-02-04'
      
      // Create ISO datetime
      const isoString = createISODateTime(dateStr, selectedTime)
      
      // Extract time part - should be exactly what was selected
      const extractedTime = getTimePart(isoString)
      
      expect(extractedTime).toBe('14:00')
    })
  })

  describe('Bug reproduction: Calendar shows 00:00', () => {
    it('should correctly identify all-day events', () => {
      // All-day event has time 00:00:00
      const allDayEvent = '2026-02-04T00:00:00'
      
      // Should be identified as all-day
      expect(isAllDay(allDayEvent)).toBe(true)
      
      // Time should not be displayed for all-day events
      expect(getTimePart(allDayEvent)).toBeNull()
    })

    it('should format time for non-all-day events', () => {
      const timedEvent = '2026-02-04T14:30:00'
      
      // Should NOT be identified as all-day
      expect(isAllDay(timedEvent)).toBe(false)
      
      // Time should be formatted correctly
      expect(formatTime(timedEvent)).toBe('14:30')
    })
  })

  describe('dateToLocalISOString', () => {
    it('should convert Date to local ISO string without timezone shift', () => {
      // Create a date at 14:30 local time
      const date = new Date(2026, 1, 4, 14, 30, 0) // Feb 4, 2026 14:30:00 (local)
      
      const result = dateToLocalISOString(date)
      
      // Should preserve the local wall-clock time
      expect(result).toBe('2026-02-04T14:30:00')
    })

    it('should handle midnight correctly', () => {
      const date = new Date(2026, 1, 4, 0, 0, 0) // Feb 4, 2026 00:00:00 (local)
      
      const result = dateToLocalISOString(date)
      
      expect(result).toBe('2026-02-04T00:00:00')
    })

    it('should handle end of day correctly', () => {
      const date = new Date(2026, 1, 4, 23, 59, 59) // Feb 4, 2026 23:59:59 (local)
      
      const result = dateToLocalISOString(date)
      
      expect(result).toBe('2026-02-04T23:59:59')
    })
  })

  describe('Timezone safety', () => {
    it('should preserve time through parse and format cycle', () => {
      // Simulate user selecting 14:00 in the time picker
      const originalTime = '14:00'
      const dateStr = '2026-02-04'
      
      // Create ISO datetime
      const _isoString = createISODateTime(dateStr, originalTime)
      
      // Simulate CalendarPage parsing and displaying
      const parsedDate = new Date(
        2026, 1, 4, 
        parseInt(originalTime.split(':')[0]), 
        parseInt(originalTime.split(':')[1])
      )
      const storedString = dateToLocalISOString(parsedDate)
      
      // Extract and verify
      const extractedTime = getTimePart(storedString)
      
      expect(extractedTime).toBe('14:00')
      expect(storedString).toBe('2026-02-04T14:00:00')
    })
  })
})
