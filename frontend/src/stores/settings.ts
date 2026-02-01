import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'

interface SettingsState {
  dateFormat: DateFormat
  setDateFormat: (format: DateFormat) => void
}

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '29/01/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '01/29/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-01-29' },
]

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dateFormat: 'DD/MM/YYYY',
      setDateFormat: (format) => set({ dateFormat: format }),
    }),
    {
      name: 'kanbot-settings',
    }
  )
)
