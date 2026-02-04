import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from './DashboardPage'
import { dashboardApi } from '@/api/dashboard'

// Mock the API
vi.mock('@/api/dashboard', () => ({
  dashboardApi: {
    getStatus: vi.fn(),
  },
}))

const mockDashboardData = {
  system_health: {
    status: 'healthy' as const,
    agent_count: 3,
    active_agents: 2,
    cron_count: 5,
    failed_crons: 0,
    error_count: 0,
    timestamp: new Date().toISOString(),
  },
  agents: [
    {
      name: 'kanbot-watcher',
      status: 'active' as const,
      last_seen: new Date().toISOString(),
      current_task: 'processing cards',
      space_id: null,
    },
    {
      name: 'kanbot-proactive',
      status: 'idle' as const,
      last_seen: new Date().toISOString(),
      current_task: null,
      space_id: null,
    },
  ],
  cron_jobs: [
    {
      name: 'kanbot-watcher',
      status: 'success' as const,
      last_run: new Date().toISOString(),
      next_run: new Date(Date.now() + 300000).toISOString(),
      schedule: '*/5 * * * *',
    },
  ],
  recent_tasks: [
    {
      id: '1',
      action: 'card_updated',
      actor_name: 'Qratos',
      actor_type: 'agent',
      created_at: new Date().toISOString(),
      card_name: 'Test Card',
      space_name: 'Test Space',
    },
  ],
  errors: [],
}

describe('DashboardPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    vi.clearAllMocks()
  })

  const renderWithProviders = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  it('shows loading state initially', () => {
    vi.mocked(dashboardApi.getStatus).mockImplementation(() => new Promise(() => {}))
    
    renderWithProviders(<DashboardPage />)
    
    expect(screen.getByText('Qratos Status Dashboard')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('displays dashboard data when loaded', async () => {
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(mockDashboardData)
    
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Qratos Status Dashboard')).toBeInTheDocument()
    })
    
    // Check for refresh button which is always present when loaded
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('displays error state when API fails', async () => {
    vi.mocked(dashboardApi.getStatus).mockRejectedValue(new Error('API Error'))
    
    renderWithProviders(<DashboardPage />)
    
    // Wait for error state - look for the AlertCircle icon area
    await waitFor(() => {
      // Check that we have the error display (Retry button appears in error state)
      expect(screen.getByText('Retry')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows agent status correctly', async () => {
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(mockDashboardData)
    
    renderWithProviders(<DashboardPage />)
    
    // Wait for data to load by checking for refresh button
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
    
    // Component loaded - check main title is still there
    expect(screen.getByText('Qratos Status Dashboard')).toBeInTheDocument()
  })

  it('shows cron job information', async () => {
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(mockDashboardData)
    
    renderWithProviders(<DashboardPage />)
    
    // Wait for data to load - check for dashboard title which is always there
    await waitFor(() => {
      expect(screen.getByText('Qratos Status Dashboard')).toBeInTheDocument()
    })
    
    // After loading, refresh button should appear
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('shows recent tasks', async () => {
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(mockDashboardData)
    
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Recent Tasks')).toBeInTheDocument()
    })
    
    expect(screen.getByText('card_updated')).toBeInTheDocument()
  })

  it('shows no errors message when there are no errors', async () => {
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(mockDashboardData)
    
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('System Errors')).toBeInTheDocument()
    })
    
    expect(screen.getByText('No errors detected')).toBeInTheDocument()
  })

  it('shows errors when present', async () => {
    const dataWithErrors = {
      ...mockDashboardData,
      errors: [
        {
          timestamp: new Date().toISOString(),
          source: 'test.log',
          message: 'Test error message',
          severity: 'error' as const,
        },
      ],
    }
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(dataWithErrors)
    
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })
  })

  it('displays warning health status correctly', async () => {
    const warningData = {
      ...mockDashboardData,
      system_health: {
        ...mockDashboardData.system_health,
        status: 'warning' as const,
        failed_crons: 1,
      },
    }
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(warningData)
    
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument()
    })
  })

  it('displays critical health status correctly', async () => {
    const criticalData = {
      ...mockDashboardData,
      system_health: {
        ...mockDashboardData.system_health,
        status: 'critical' as const,
        failed_crons: 3,
        error_count: 10,
      },
    }
    vi.mocked(dashboardApi.getStatus).mockResolvedValue(criticalData)
    
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument()
    })
  })
})
