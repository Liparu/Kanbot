import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SpaceDashboard from '../SpaceDashboard'

// Mock the spaces API
vi.mock('@/api/spaces', () => ({
  spacesApi: {
    get: vi.fn(),
    stats: vi.fn(),
    update: vi.fn(),
  },
}))

import { spacesApi } from '@/api/spaces'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}))

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const mockSpace = {
  id: 'test-space-id',
  name: 'Test Space',
  type: 'company',
  owner_id: 'owner-id',
  color: null,
  settings: {},
  calendar_public: false,
  created_at: '2024-01-01T00:00:00Z',
  members: [
    {
      user_id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      agent_permissions: {},
      joined_at: '2024-01-01T00:00:00Z',
    },
  ],
}

const mockStats = {
  space_id: 'test-space-id',
  total_cards: 10,
  waiting_cards: 2,
  urgent_cards: 1,
  inbox_cards: 3,
  in_progress_cards: 4,
  review_cards: 0,
  archive_cards: 5,
}

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/spaces/test-space-id']}>
        <Routes>
          <Route path="/spaces/:spaceId" element={component} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SpaceDashboard - Member Rename', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spacesApi.get).mockResolvedValue(mockSpace)
    vi.mocked(spacesApi.stats).mockResolvedValue(mockStats)
    vi.mocked(spacesApi.update).mockResolvedValue({ ...mockSpace, name: 'Renamed Space' })
  })

  it('should display space name', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })
  })

  it('should show edit button on hover', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // The edit button should be in the document (even if not visible until hover)
    const editButton = screen.getByTitle('common.edit')
    expect(editButton).toBeInTheDocument()
  })

  it('should enter edit mode when edit button is clicked', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Should show input field with current name
    const input = screen.getByDisplayValue('Test Space')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('should allow editing space name', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Change the name
    const input = screen.getByDisplayValue('Test Space')
    fireEvent.change(input, { target: { value: 'New Space Name' } })

    expect(input).toHaveValue('New Space Name')
  })

  it('should save space name when save button is clicked', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Change the name
    const input = screen.getByDisplayValue('Test Space')
    fireEvent.change(input, { target: { value: 'Renamed Space' } })

    // Click save button
    const saveButton = screen.getByTitle('common.save')
    fireEvent.click(saveButton)

    // Verify API was called
    await waitFor(() => {
      expect(spacesApi.update).toHaveBeenCalledWith('test-space-id', { name: 'Renamed Space' })
    })
  })

  it('should save on Enter key press', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Change the name and press Enter
    const input = screen.getByDisplayValue('Test Space')
    fireEvent.change(input, { target: { value: 'Renamed Space' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Verify API was called
    await waitFor(() => {
      expect(spacesApi.update).toHaveBeenCalledWith('test-space-id', { name: 'Renamed Space' })
    })
  })

  it('should cancel editing on Escape key press', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Change the name and press Escape
    const input = screen.getByDisplayValue('Test Space')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    // Should return to display mode with original name
    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // API should not have been called
    expect(spacesApi.update).not.toHaveBeenCalled()
  })

  it('should cancel editing when cancel button is clicked', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Change the name
    const input = screen.getByDisplayValue('Test Space')
    fireEvent.change(input, { target: { value: 'New Name' } })

    // Click cancel button
    const cancelButton = screen.getByTitle('common.cancel')
    fireEvent.click(cancelButton)

    // Should return to display mode with original name
    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // API should not have been called
    expect(spacesApi.update).not.toHaveBeenCalled()
  })

  it('should not save if name is empty', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Clear the name
    const input = screen.getByDisplayValue('Test Space')
    fireEvent.change(input, { target: { value: '' } })

    // Save button should be disabled
    const saveButton = screen.getByTitle('common.save')
    expect(saveButton).toBeDisabled()
  })

  it('should not save if name is unchanged', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByTitle('common.edit')
    fireEvent.click(editButton)

    // Don't change the name, just click save
    const saveButton = screen.getByTitle('common.save')
    fireEvent.click(saveButton)

    // API should not have been called since name is unchanged
    expect(spacesApi.update).not.toHaveBeenCalled()

    // Should exit edit mode
    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeInTheDocument()
    })
  })

  it('should display member count', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/1 spaces.members/)).toBeInTheDocument()
    })
  })

  it('should display space type', async () => {
    renderWithProviders(<SpaceDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/spaces.company/)).toBeInTheDocument()
    })
  })
})
