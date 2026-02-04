import { describe, it, expect } from 'vitest'
import type { Card, SimpleUser } from '@/types'
import { formatDateTime, parseISOLocal } from '@/utils/dateFormat'
import type { DateFormat } from '@/stores/settings'

describe('Card Creator Feature', () => {
  it('should have creator field in Card type', () => {
    const mockCreator: SimpleUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    }

    const mockCard: Card = {
      id: 'card-123',
      column_id: 'col-123',
      name: 'Test Card',
      description: 'Test description',
      position: 0,
      task_counter: 0,
      task_completed_counter: 0,
      metadata_json: {},
      created_by: 'user-123',
      created_at: '2026-02-04T10:00:00Z',
      updated_at: '2026-02-04T10:00:00Z',
      tags: [],
      assignees: [],
      creator: mockCreator, // This should compile without errors
    }

    expect(mockCard.creator).toBeDefined()
    expect(mockCard.creator?.username).toBe('testuser')
    expect(mockCard.created_by).toBe('user-123')
    expect(mockCard.created_at).toBe('2026-02-04T10:00:00Z')
  })

  it('should allow card without creator (for backward compatibility)', () => {
    const mockCard: Card = {
      id: 'card-123',
      column_id: 'col-123',
      name: 'Test Card',
      position: 0,
      task_counter: 0,
      task_completed_counter: 0,
      metadata_json: {},
      created_at: '2026-02-04T10:00:00Z',
      updated_at: '2026-02-04T10:00:00Z',
      tags: [],
      assignees: [],
      // creator is optional
    }

    expect(mockCard.creator).toBeUndefined()
  })
})

describe('Card Creation Tracking', () => {
  it('should track who created a card and when', () => {
    const creator: SimpleUser = {
      id: 'creator-456',
      username: 'johndoe',
      email: 'john@example.com',
    }

    const card: Card = {
      id: 'card-789',
      column_id: 'col-456',
      name: 'New Feature',
      position: 1,
      task_counter: 0,
      task_completed_counter: 0,
      metadata_json: {},
      created_by: creator.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      assignees: [],
      creator: creator,
    }

    // Verify card tracks creation metadata
    expect(card.created_by).toBe(creator.id)
    expect(card.creator).toEqual(creator)
    expect(new Date(card.created_at).getTime()).toBeLessThanOrEqual(Date.now())
  })
})

describe('Card Detail Time Display Bug Fix', () => {
  it('should use formatDateTime instead of toLocaleString for created_at', () => {
    // This test documents the expected behavior after the fix
    // The bug: using new Date(card.created_at).toLocaleString() causes timezone shifts
    // The fix: use formatDateTime(card.created_at, dateFormat, use24Hour)
    
    const createdAt = '2026-02-04T14:30:00'
    const dateFormat: DateFormat = 'DD/MM/YYYY'
    
    // Using the correct utility function (timezone-safe)
    const formatted = formatDateTime(createdAt, dateFormat, true)
    
    // Should display as 04/02/2026 14:30 (not shifted by timezone)
    expect(formatted).toBe('04/02/2026 14:30')
    
    // Verify parseISOLocal preserves the time correctly
    const parsed = parseISOLocal(createdAt)
    expect(parsed.getHours()).toBe(14)
    expect(parsed.getMinutes()).toBe(30)
  })

  it('should use formatDateTime for comment timestamps', () => {
    const commentCreatedAt = '2026-02-04T09:15:00'
    const dateFormat: DateFormat = 'YYYY-MM-DD'
    
    const formatted = formatDateTime(commentCreatedAt, dateFormat, true)
    
    // Should display correctly without timezone shift
    expect(formatted).toBe('2026-02-04 09:15')
  })

  it('should handle timezone edge case: UTC timestamps should not shift', () => {
    // If backend returns a UTC timestamp like '2026-02-04T14:30:00Z'
    // It should still display as 14:30 local time (wall-clock preservation)
    const utcTimestamp = '2026-02-04T14:30:00Z'
    const dateFormat: DateFormat = 'DD/MM/YYYY'
    
    const formatted = formatDateTime(utcTimestamp, dateFormat, true)
    
    // Should preserve 14:30 (wall-clock time), not shift to 15:30 or 13:30
    expect(formatted).toBe('04/02/2026 14:30')
  })

  it('should format all-day events without time', () => {
    const allDayEvent = '2026-02-04T00:00:00'
    const dateFormat: DateFormat = 'DD/MM/YYYY'
    
    const formatted = formatDateTime(allDayEvent, dateFormat, true)
    
    // All-day events should show only date, no time
    expect(formatted).toBe('04/02/2026')
  })
})
