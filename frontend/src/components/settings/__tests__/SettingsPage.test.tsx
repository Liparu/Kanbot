import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SettingsPage from '../SettingsPage'

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      is_admin: false,
    },
    updateUser: vi.fn(),
  }),
}))

// Mock the settings store
vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    dateFormat: 'relative',
    setDateFormat: vi.fn(),
  }),
  DATE_FORMAT_OPTIONS: [
    { value: 'relative', label: 'Relative', example: '2 hours ago' },
    { value: 'absolute', label: 'Absolute', example: 'Jan 1, 2024' },
  ],
}))

// Mock the auth API
vi.mock('@/api/auth', () => ({
  authApi: {
    listApiKeys: vi.fn().mockResolvedValue([]),
    createApiKey: vi.fn().mockResolvedValue({
      id: 'test-key-id',
      name: 'Test Key',
      key: 'kb_test_api_key_12345',
      created_at: new Date().toISOString(),
    }),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
  },
}))

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

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('SettingsPage - API Key Copy', () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>
  let execCommand: ReturnType<typeof vi.fn>
  let originalIsSecureContext: boolean | undefined

  beforeEach(() => {
    clipboardWriteText = vi.fn().mockResolvedValue(undefined)
    execCommand = vi.fn().mockReturnValue(true)
    
    // Store original value
    originalIsSecureContext = window.isSecureContext
    
    // Mock secure context
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    })
    
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    })
    
    // Mock document.execCommand
    document.execCommand = execCommand
  })

  afterEach(() => {
    // Restore original value
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
  })

  it('should copy API key to clipboard when copy button is clicked', async () => {
    renderWithProviders(<SettingsPage />)

    // Click create key button to open modal
    const createKeyButton = screen.getByText('Create Key')
    fireEvent.click(createKeyButton)

    // Enter key name
    const nameInput = screen.getByPlaceholderText('e.g., My Integration, Automation Bot')
    fireEvent.change(nameInput, { target: { value: 'Test Key' } })

    // Submit form
    const generateButton = screen.getByText('Generate Key')
    fireEvent.click(generateButton)

    // Wait for the key to be displayed
    await waitFor(() => {
      expect(screen.getByText('Save your API key now')).toBeInTheDocument()
    })

    // Click copy button
    const copyButton = screen.getByTitle('Copy to clipboard')
    fireEvent.click(copyButton)

    // Verify clipboard was called with the API key
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith('kb_test_api_key_12345')
    })

    // Verify copied state is shown (button should show checkmark)
    await waitFor(() => {
      // After successful copy, the copied state should be visible
      // The Check icon should be present (with green color)
      const checkIcon = copyButton.querySelector('svg')
      expect(checkIcon).toBeTruthy()
    })
  })

  it('should handle clipboard write errors gracefully', async () => {
    // Mock clipboard to throw an error
    clipboardWriteText.mockRejectedValue(new Error('Clipboard access denied'))

    // Mock console.error to suppress error output in test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithProviders(<SettingsPage />)

    // Click create key button to open modal
    const createKeyButton = screen.getByText('Create Key')
    fireEvent.click(createKeyButton)

    // Enter key name and submit
    const nameInput = screen.getByPlaceholderText('e.g., My Integration, Automation Bot')
    fireEvent.change(nameInput, { target: { value: 'Test Key' } })

    const generateButton = screen.getByText('Generate Key')
    fireEvent.click(generateButton)

    // Wait for the key to be displayed
    await waitFor(() => {
      expect(screen.getByText('Save your API key now')).toBeInTheDocument()
    })

    // Click copy button
    const copyButton = screen.getByTitle('Copy to clipboard')
    
    // Should not throw error
    expect(() => fireEvent.click(copyButton)).not.toThrow()

    consoleErrorSpy.mockRestore()
  })

  it('should use fallback copy method when not in secure context', async () => {
    // Set non-secure context to trigger fallback
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      writable: true,
      configurable: true,
    })

    renderWithProviders(<SettingsPage />)

    // Click create key button to open modal
    const createKeyButton = screen.getByText('Create Key')
    fireEvent.click(createKeyButton)

    // Enter key name and submit
    const nameInput = screen.getByPlaceholderText('e.g., My Integration, Automation Bot')
    fireEvent.change(nameInput, { target: { value: 'Test Key' } })

    const generateButton = screen.getByText('Generate Key')
    fireEvent.click(generateButton)

    // Wait for the key to be displayed
    await waitFor(() => {
      expect(screen.getByText('Save your API key now')).toBeInTheDocument()
    })

    // Click copy button - should use fallback
    const copyButton = screen.getByTitle('Copy to clipboard')
    fireEvent.click(copyButton)

    // Verify fallback was used (execCommand called)
    await waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith('copy')
    })

    // Verify copied state is shown even with fallback
    await waitFor(() => {
      const checkIcon = copyButton.querySelector('svg')
      expect(checkIcon).toBeTruthy()
    })
  })
})
