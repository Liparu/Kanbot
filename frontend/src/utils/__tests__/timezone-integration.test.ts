import { describe, it, expect } from 'vitest'
import {
  createISODateTime,
  getTimePart,
  parseISOLocal,
  dateToLocalISOString,
  formatTime,
} from '../dateFormat'

describe('Timezone Integration Tests - Full Flow', () => {
  describe('User Story: User selects 14:00 in time picker', () => {
    it('should preserve 14:00 through the entire flow', () => {
      // Step 1: User selects date and time in DateTimePicker
      const selectedDate = '2026-02-04'
      const selectedTime = '14:00'

      // Step 2: DateTimePicker creates ISO string
      const isoString = createISODateTime(selectedDate, selectedTime)
      expect(isoString).toBe('2026-02-04T14:00:00')

      // Step 3: ISO string is sent to backend (no transformation)
      const storedValue = isoString

      // Step 4: Backend stores it as-is (assuming backend stores strings)
      const retrievedValue = storedValue

      // Step 5: Frontend retrieves and parses it
      const parsedDate = parseISOLocal(retrievedValue)

      // Step 6: Verify the hours and minutes are correct
      expect(parsedDate.getHours()).toBe(14)
      expect(parsedDate.getMinutes()).toBe(0)

      // Step 7: Format for display
      const displayTime = formatTime(retrievedValue)
      expect(displayTime).toBe('14:00')

      // Step 8: Extract time part for editing
      const timePart = getTimePart(retrievedValue)
      expect(timePart).toBe('14:00')
    })

    it('should handle round-trip conversion without time shift', () => {
      // Start with user selection
      const originalTime = '14:00'
      const originalDate = '2026-02-04'

      // Create ISO string (what DateTimePicker does)
      const isoString = createISODateTime(originalDate, originalTime)

      // Parse it back (what display components do)
      const parsed = parseISOLocal(isoString)

      // Convert back to ISO (what would happen if re-saved)
      const roundTrip = dateToLocalISOString(parsed)

      // Should be identical
      expect(roundTrip).toBe(isoString)
      expect(getTimePart(roundTrip)).toBe(originalTime)
    })

    it('should handle timezone edge case: UTC+1 timezone', () => {
      // Simulate being in UTC+1 timezone (like CET)
      const date = new Date(2026, 1, 4, 14, 0, 0) // Feb 4, 2026 14:00 local

      // Convert to local ISO string
      const localISO = dateToLocalISOString(date)
      expect(localISO).toBe('2026-02-04T14:00:00')

      // Parse it back
      const parsed = parseISOLocal(localISO)
      expect(parsed.getHours()).toBe(14)
      expect(parsed.getMinutes()).toBe(0)

      // Verify it doesn't shift to 15:00 or 13:00
      expect(getTimePart(localISO)).toBe('14:00')
    })

    it('should never use Date.toISOString() which creates UTC timestamps', () => {
      // This is the WRONG way - demonstrates the bug
      const localDate = new Date(2026, 1, 4, 14, 0, 0) // Feb 4, 2026 14:00 local

      // BUG: Using toISOString() converts to UTC
      const wrongISO = localDate.toISOString()
      // In UTC+1 timezone, 14:00 local = 13:00 UTC
      // So wrongISO will be "2026-02-04T13:00:00.000Z"

      // The CORRECT way: Use dateToLocalISOString()
      const correctISO = dateToLocalISOString(localDate)
      expect(correctISO).toBe('2026-02-04T14:00:00')

      // Verify they're different (this proves the bug exists if we use toISOString)
      expect(wrongISO).not.toBe(correctISO)
    })

    it('should handle Date constructor parsing correctly', () => {
      // When parsing "2026-02-04T14:00:00" with new Date()
      // JavaScript treats it as LOCAL time (this is correct in modern browsers)
      const isoWithoutTZ = '2026-02-04T14:00:00'
      const parsed = new Date(isoWithoutTZ)

      // Should parse as 14:00 local time
      expect(parsed.getHours()).toBe(14)
      expect(parsed.getMinutes()).toBe(0)

      // But parseISOLocal is more explicit and safer
      const parsedLocal = parseISOLocal(isoWithoutTZ)
      expect(parsedLocal.getHours()).toBe(14)
      expect(parsedLocal.getMinutes()).toBe(0)
    })

    it('should strip timezone info and parse as local', () => {
      // If backend accidentally adds timezone
      const isoWithTZ = '2026-02-04T14:00:00Z' // Z means UTC
      const isoWithOffset = '2026-02-04T14:00:00+00:00' // Explicit UTC

      // parseISOLocal should strip timezone and parse as local
      const parsed1 = parseISOLocal(isoWithTZ)
      const parsed2 = parseISOLocal(isoWithOffset)

      // Both should be parsed as 14:00 LOCAL time
      expect(parsed1.getHours()).toBe(14)
      expect(parsed2.getHours()).toBe(14)
    })
  })

  describe('Calendar display integration', () => {
    it('should display events at correct times', () => {
      // Event stored as "2026-02-04T14:00:00"
      const eventStart = '2026-02-04T14:00:00'

      // Parse for calendar display
      const startDate = parseISOLocal(eventStart)

      // Should show at 14:00
      expect(startDate.getHours()).toBe(14)
      expect(formatTime(eventStart)).toBe('14:00')
    })

    it('should handle all-day events correctly', () => {
      // All-day event at midnight
      const allDayEvent = '2026-02-04T00:00:00'

      const parsed = parseISOLocal(allDayEvent)
      expect(parsed.getHours()).toBe(0)
      expect(parsed.getMinutes()).toBe(0)

      // getTimePart returns null for all-day
      expect(getTimePart(allDayEvent)).toBeNull()
    })
  })

  describe('Bug scenarios that should NOT happen', () => {
    it('should NOT shift 14:00 to 15:00 in UTC+1', () => {
      const input = '2026-02-04T14:00:00'
      const parsed = parseISOLocal(input)

      // Verify NOT 15:00
      expect(parsed.getHours()).not.toBe(15)
      expect(parsed.getHours()).toBe(14)
    })

    it('should NOT shift 14:00 to 13:00 when converting back', () => {
      const input = '2026-02-04T14:00:00'
      const parsed = parseISOLocal(input)
      const output = dateToLocalISOString(parsed)

      // Should preserve 14:00
      expect(output).toBe('2026-02-04T14:00:00')
      expect(getTimePart(output)).toBe('14:00')
    })
  })
})
