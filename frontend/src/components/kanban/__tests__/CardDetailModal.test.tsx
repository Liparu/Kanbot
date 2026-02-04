import { describe, it, expect } from 'vitest'
import type { Card, SimpleUser } from '@/types'

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
