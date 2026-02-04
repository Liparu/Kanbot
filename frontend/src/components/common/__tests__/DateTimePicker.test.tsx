import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DateTimePicker from '../DateTimePicker'
import { createISODateTime, getTimePart } from '@/utils/dateFormat'

// Mock the settings store
vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: any) => {
    const state = {
      dateFormat: 'YYYY-MM-DD' as const,
    }
    return selector ? selector(state) : state
  },
}))

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('DateTimePicker timezone bug', () => {
  it('should not shift time by +1 hour when user selects 14:00', () => {
    const onChange = vi.fn()
    const testDate = '2026-02-04'
    const testTime = '14:00'
    const initialValue = createISODateTime(testDate, testTime)

    render(
      <DateTimePicker
        value={initialValue}
        onChange={onChange}
      />
    )

    // Verify the input displays correctly
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('2026-02-04 14:00')
  })

  it('should preserve time when creating ISO datetime string', () => {
    // Simulate what happens when user selects 14:00 in the time picker
    const dateStr = '2026-02-04'
    const timeStr = '14:00'

    // This is what createISODateTime should return
    const isoString = createISODateTime(dateStr, timeStr)
    expect(isoString).toBe('2026-02-04T14:00:00')

    // Extract time - should be exactly what was input
    const extractedTime = getTimePart(isoString)
    expect(extractedTime).toBe('14:00')
  })

  it('should handle time selector change without timezone shift', () => {
    const onChange = vi.fn()
    const testDate = '2026-02-04'
    const initialValue = createISODateTime(testDate, '09:00')

    render(
      <DateTimePicker
        value={initialValue}
        onChange={onChange}
      />
    )

    // Open the picker
    const input = screen.getByRole('textbox')
    fireEvent.click(input)

    // Find and change the hour selector to 14
    const hourSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(hourSelect, { target: { value: '14' } })

    // onChange should be called with the correct time (14:00, not 15:00)
    expect(onChange).toHaveBeenCalled()
    const [newValue] = onChange.mock.calls[onChange.mock.calls.length - 1]

    // Extract the time part from the returned value
    const timePart = getTimePart(newValue)
    expect(timePart).toBe('14:00')
    expect(newValue).toBe('2026-02-04T14:00:00')
  })

  it('should handle all-day toggle correctly', () => {
    const onChange = vi.fn()
    const testDate = '2026-02-04'
    const testTime = '14:00'
    const initialValue = createISODateTime(testDate, testTime)

    render(
      <DateTimePicker
        value={initialValue}
        onChange={onChange}
      />
    )

    // Open the picker
    const input = screen.getByRole('textbox')
    fireEvent.click(input)

    // Find the all-day toggle button (it's the toggle switch)
    const buttons = screen.getAllByRole('button')
    // The toggle is the one with the inline-flex class (it's a switch)
    const allDayToggle = buttons.find(btn =>
      btn.className.includes('inline-flex') && btn.className.includes('rounded-full')
    )

    expect(allDayToggle).toBeDefined()
    fireEvent.click(allDayToggle!)

    // Should set time to 00:00:00 for all-day
    expect(onChange).toHaveBeenCalledWith(
      '2026-02-04T00:00:00',
      true // isAllDay flag
    )
  })

  it('should display correct time in different timezones', () => {
    // This test ensures we're not affected by browser timezone
    const onChange = vi.fn()
    const isoString = '2026-02-04T14:00:00'

    render(
      <DateTimePicker
        value={isoString}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('textbox')
    // Should always show 14:00 regardless of timezone
    expect(input).toHaveValue('2026-02-04 14:00')
  })
})
