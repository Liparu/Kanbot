import { describe, it, expect } from 'vitest'
import { processEventsForDisplay } from './calendar'
import { parseISOLocal } from './dateFormat'

describe('processEventsForDisplay', () => {
  it('should preserve original start time for first day segment', () => {
    // Create an event at 14:30
    const eventStart = new Date(2026, 1, 4, 14, 30, 0) // Feb 4, 2026 14:30
    const eventEnd = new Date(2026, 1, 4, 15, 30, 0)   // Feb 4, 2026 15:30
    
    const events = [{
      id: '1',
      title: 'Test Event',
      start: eventStart,
      end: eventEnd,
      color: '#ff0000',
      isAllDay: false,
      card: {} as any,
    }]
    
    const result = processEventsForDisplay(events)
    
    // Should have exactly one segment for single-day event
    expect(result).toHaveLength(1)
    
    // The start time should be preserved as 14:30, NOT 00:00
    const segment = result[0]
    expect(segment.start.getHours()).toBe(14)
    expect(segment.start.getMinutes()).toBe(30)
    expect(segment.isFirstDay).toBe(true)
  })
  
  it('should preserve time when parsing from ISO string (real-world scenario)', () => {
    // This mimics how CalendarPage parses dates from API
    const isoString = '2026-02-04T14:30:00'
    const eventStart = parseISOLocal(isoString)
    const eventEnd = parseISOLocal('2026-02-04T15:30:00')
    
    // Verify parsing worked correctly
    expect(eventStart.getHours()).toBe(14)
    expect(eventStart.getMinutes()).toBe(30)
    
    const events = [{
      id: '1',
      title: 'Test Event',
      start: eventStart,
      end: eventEnd,
      color: '#ff0000',
      isAllDay: false,
      card: {} as any,
    }]
    
    const result = processEventsForDisplay(events)
    
    // The bug fix: first segment should preserve time (14:30), NOT show 00:00
    const segment = result[0]
    expect(segment.start.getHours()).toBe(14)
    expect(segment.start.getMinutes()).toBe(30)
  })
  
  it('should preserve original start time for multi-day event first segment', () => {
    // Create a multi-day event starting at 14:30
    const eventStart = new Date(2026, 1, 4, 14, 30, 0) // Feb 4, 2026 14:30
    const eventEnd = new Date(2026, 1, 6, 15, 30, 0)   // Feb 6, 2026 15:30
    
    const events = [{
      id: '1',
      title: 'Multi-Day Event',
      start: eventStart,
      end: eventEnd,
      color: '#ff0000',
      isAllDay: false,
      card: {} as any,
    }]
    
    const result = processEventsForDisplay(events)
    
    // Should have 3 segments (Feb 4, 5, 6)
    expect(result).toHaveLength(3)
    
    // First segment should preserve original start time (14:30)
    const firstSegment = result[0]
    expect(firstSegment.start.getHours()).toBe(14)
    expect(firstSegment.start.getMinutes()).toBe(30)
    expect(firstSegment.isFirstDay).toBe(true)
    
    // Second and third segments should ALSO preserve original start time (14:30)
    // This is the bug fix - continuation days should show the same time, not 00:00
    const secondSegment = result[1]
    expect(secondSegment.start.getHours()).toBe(14)
    expect(secondSegment.start.getMinutes()).toBe(30)
    expect(secondSegment.isFirstDay).toBe(false)
    
    const thirdSegment = result[2]
    expect(thirdSegment.start.getHours()).toBe(14)
    expect(thirdSegment.start.getMinutes()).toBe(30)
    expect(thirdSegment.isFirstDay).toBe(false)
  })
})
