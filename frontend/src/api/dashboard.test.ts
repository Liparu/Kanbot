import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dashboardApi } from './dashboard'
import { api } from './client'

// Mock the API client
vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
  },
}))

describe('dashboardApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStatus', () => {
    it('fetches dashboard status successfully', async () => {
      const mockResponse = {
        data: {
          system_health: {
            status: 'healthy',
            agent_count: 3,
            active_agents: 2,
            cron_count: 5,
            failed_crons: 0,
            error_count: 0,
            timestamp: new Date().toISOString(),
          },
          agents: [],
          cron_jobs: [],
          recent_tasks: [],
          errors: [],
        },
      }

      vi.mocked(api.get).mockResolvedValue(mockResponse)

      const result = await dashboardApi.getStatus()

      expect(api.get).toHaveBeenCalledWith('/dashboard/status')
      expect(result).toEqual(mockResponse.data)
      expect(result.system_health.status).toBe('healthy')
    })

    it('handles API errors', async () => {
      const error = new Error('Network error')
      vi.mocked(api.get).mockRejectedValue(error)

      await expect(dashboardApi.getStatus()).rejects.toThrow('Network error')
      expect(api.get).toHaveBeenCalledWith('/dashboard/status')
    })

    it('returns correct data structure', async () => {
      const mockResponse = {
        data: {
          system_health: {
            status: 'warning',
            agent_count: 5,
            active_agents: 3,
            cron_count: 6,
            failed_crons: 1,
            error_count: 2,
            timestamp: '2026-02-04T19:00:00Z',
          },
          agents: [
            {
              name: 'test-agent',
              status: 'active',
              last_seen: '2026-02-04T19:00:00Z',
              current_task: 'testing',
              space_id: 'space-1',
            },
          ],
          cron_jobs: [
            {
              name: 'test-cron',
              status: 'success',
              last_run: '2026-02-04T18:00:00Z',
              next_run: '2026-02-04T20:00:00Z',
              schedule: '0 */2 * * *',
            },
          ],
          recent_tasks: [
            {
              id: 'task-1',
              action: 'card_created',
              actor_name: 'Qratos',
              actor_type: 'agent',
              created_at: '2026-02-04T19:00:00Z',
              card_name: 'Test Card',
              space_name: 'Test Space',
            },
          ],
          errors: [
            {
              timestamp: '2026-02-04T19:00:00Z',
              source: 'test.log',
              message: 'Test error',
              severity: 'error',
            },
          ],
        },
      }

      vi.mocked(api.get).mockResolvedValue(mockResponse)

      const result = await dashboardApi.getStatus()

      // Verify all expected fields are present
      expect(result).toHaveProperty('system_health')
      expect(result).toHaveProperty('agents')
      expect(result).toHaveProperty('cron_jobs')
      expect(result).toHaveProperty('recent_tasks')
      expect(result).toHaveProperty('errors')

      // Verify agent fields
      expect(result.agents[0]).toHaveProperty('name')
      expect(result.agents[0]).toHaveProperty('status')
      expect(result.agents[0]).toHaveProperty('last_seen')

      // Verify cron job fields
      expect(result.cron_jobs[0]).toHaveProperty('name')
      expect(result.cron_jobs[0]).toHaveProperty('schedule')

      // Verify task fields
      expect(result.recent_tasks[0]).toHaveProperty('action')
      expect(result.recent_tasks[0]).toHaveProperty('actor_name')

      // Verify error fields
      expect(result.errors[0]).toHaveProperty('severity')
      expect(result.errors[0]).toHaveProperty('message')
    })

    it('handles empty data', async () => {
      const mockResponse = {
        data: {
          system_health: {
            status: 'healthy',
            agent_count: 0,
            active_agents: 0,
            cron_count: 0,
            failed_crons: 0,
            error_count: 0,
            timestamp: new Date().toISOString(),
          },
          agents: [],
          cron_jobs: [],
          recent_tasks: [],
          errors: [],
        },
      }

      vi.mocked(api.get).mockResolvedValue(mockResponse)

      const result = await dashboardApi.getStatus()

      expect(result.agents).toHaveLength(0)
      expect(result.cron_jobs).toHaveLength(0)
      expect(result.recent_tasks).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })
  })
})
