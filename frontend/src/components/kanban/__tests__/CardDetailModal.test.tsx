import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CardDetailModal from '../CardDetailModal'

// Mock the API modules
vi.mock('@/api/boards', () => ({
  cardsApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
  },
  tagsApi: {
    list: vi.fn(),
  },
}))

vi.mock('@/api/spaces', () => ({
  spacesApi: {
    get: vi.fn(),
  },
}))

// Mock the board store
vi.mock('@/stores/boards', () => ({
  useBoardStore: () => ({
    updateCard: vi.fn(),
    removeCard: vi.fn(),
  }),
}))

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Mock the toast hook
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock the confirm dialog
vi.mock('@/components/common/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(false),
}))

// Mock framer-motion with all required exports
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock DateTimePicker to avoid complex date picker internals
vi.mock('@/components/common/DateTimePicker', () => ({
  default: ({ value, onChange }: any) => (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value, false)}
      data-testid="datetime-picker"
    />
  ),
}))

import { cardsApi, tagsApi } from '@/api/boards'
import { spacesApi } from '@/api/spaces'

const mockCard = {
  id: 'card-1',
  name: 'Test Card',
  description: 'Initial description',
  column_id: 'col-1',
  position: 0,
  start_date: null,
  end_date: null,
  location: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: 'user-1',
  assignees: [],
  tags: [],
  tasks: [],
  comments: [],
  task_counter: 0,
  task_completed_counter: 0,
}

const mockSpace = {
  id: 'space-1',
  name: 'Test Space',
  description: null,
  owner_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  members: [],
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('CardDetailModal auto-save description', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cardsApi.get).mockResolvedValue(mockCard)
    vi.mocked(spacesApi.get).mockResolvedValue(mockSpace)
    vi.mocked(cardsApi.update).mockResolvedValue({ ...mockCard })
    vi.mocked(tagsApi.list).mockResolvedValue([])
  })

  it('should auto-save description when textarea loses focus (onBlur)', async () => {
    renderWithQueryClient(
      <CardDetailModal
        cardId="card-1"
        columnId="col-1"
        spaceId="space-1"
        onClose={vi.fn()}
      />
    )

    // Wait for the card to load
    await waitFor(() => {
      expect(screen.getByText('Initial description')).toBeInTheDocument()
    })

    // Click on the description to enter edit mode
    const descriptionText = screen.getByText('Initial description')
    fireEvent.click(descriptionText)

    // Find the textarea and change the value
    const textarea = screen.getByPlaceholderText('cards.description')
    fireEvent.change(textarea, { target: { value: 'Updated description text' } })

    // Trigger blur to auto-save
    fireEvent.blur(textarea)

    // Verify that the update API was called with the new description
    await waitFor(() => {
      expect(cardsApi.update).toHaveBeenCalledWith('card-1', {
        description: 'Updated description text',
      })
    })
  })

  it('should not call update when description has not changed', async () => {
    renderWithQueryClient(
      <CardDetailModal
        cardId="card-1"
        columnId="col-1"
        spaceId="space-1"
        onClose={vi.fn()}
      />
    )

    // Wait for the card to load
    await waitFor(() => {
      expect(screen.getByText('Initial description')).toBeInTheDocument()
    })

    // Click on the description to enter edit mode
    const descriptionText = screen.getByText('Initial description')
    fireEvent.click(descriptionText)

    // Find the textarea but don't change the value
    const textarea = screen.getByPlaceholderText('cards.description')
    
    // Trigger blur without making changes
    fireEvent.blur(textarea)

    // Verify that the update API was NOT called (since nothing changed)
    await waitFor(() => {
      expect(cardsApi.update).not.toHaveBeenCalled()
    })
  })

  it('should still allow explicit save via Save button', async () => {
    renderWithQueryClient(
      <CardDetailModal
        cardId="card-1"
        columnId="col-1"
        spaceId="space-1"
        onClose={vi.fn()}
      />
    )

    // Wait for the card to load
    await waitFor(() => {
      expect(screen.getByText('Initial description')).toBeInTheDocument()
    })

    // Click on the description to enter edit mode
    const descriptionText = screen.getByText('Initial description')
    fireEvent.click(descriptionText)

    // Find the textarea and change the value
    const textarea = screen.getByPlaceholderText('cards.description')
    fireEvent.change(textarea, { target: { value: 'Another description' } })

    // Click the Save button explicitly
    const saveButton = screen.getByText('common.save')
    fireEvent.click(saveButton)

    // Verify that the update API was called
    await waitFor(() => {
      expect(cardsApi.update).toHaveBeenCalledWith('card-1', {
        description: 'Another description',
      })
    })
  })

  it('should allow cancel to discard changes', async () => {
    renderWithQueryClient(
      <CardDetailModal
        cardId="card-1"
        columnId="col-1"
        spaceId="space-1"
        onClose={vi.fn()}
      />
    )

    // Wait for the card to load
    await waitFor(() => {
      expect(screen.getByText('Initial description')).toBeInTheDocument()
    })

    // Click on the description to enter edit mode
    const descriptionText = screen.getByText('Initial description')
    fireEvent.click(descriptionText)

    // Find the textarea and change the value
    const textarea = screen.getByPlaceholderText('cards.description')
    fireEvent.change(textarea, { target: { value: 'Discarded changes' } })

    // Click the Cancel button
    const cancelButton = screen.getByText('common.cancel')
    fireEvent.click(cancelButton)

    // Verify that the update API was NOT called (changes were discarded)
    await waitFor(() => {
      expect(cardsApi.update).not.toHaveBeenCalled()
    })

    // Verify we're back to viewing mode with original text
    expect(screen.getByText('Initial description')).toBeInTheDocument()
  })
})
