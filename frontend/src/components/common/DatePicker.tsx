import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid } from 'date-fns'
import { Calendar, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '@/stores/settings'
import { getDateFnsFormat, getPlaceholder } from '@/utils/dateFormat'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function DatePicker({ value, onChange, placeholder, className = '' }: DatePickerProps) {
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const dateFnsFormat = getDateFnsFormat(dateFormat)
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date())
      if (isValid(date)) {
        setInputValue(format(date, dateFnsFormat))
      }
    } else {
      setInputValue('')
    }
  }, [value, dateFnsFormat])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)

    const expectedLength = dateFnsFormat.length
    if (val.length === expectedLength) {
      const parsed = parse(val, dateFnsFormat, new Date())
      if (isValid(parsed)) {
        onChange(format(parsed, 'yyyy-MM-dd'))
      }
    }
  }

  const handleDaySelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, 'yyyy-MM-dd'))
      setIsOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setInputValue('')
  }

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || getPlaceholder(dateFormat)}
          className="w-full px-3 py-2 pr-16 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-dark-400 hover:text-dark-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-dark-400 hover:text-dark-200 rounded"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute z-50 mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl"
          >
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              showOutsideDays
              fixedWeeks
              formatters={{
                formatCaption: (date) => format(date, 'MMMM yyyy'),
              }}
              classNames={{
                root: 'p-3',
                months: 'flex flex-col',
                month: 'space-y-3',
                caption: 'flex justify-center relative items-center h-8',
                caption_label: 'text-sm font-medium text-dark-100',
                nav: 'flex items-center gap-1',
                nav_button: 'h-7 w-7 bg-transparent hover:bg-dark-700 rounded-lg flex items-center justify-center text-dark-300 hover:text-dark-100',
                nav_button_previous: 'absolute left-1',
                nav_button_next: 'absolute right-1',
                table: 'w-full border-collapse',
                head_row: 'flex',
                head_cell: 'text-dark-500 w-8 font-normal text-xs text-center',
                row: 'flex w-full mt-1',
                cell: 'text-center text-sm relative p-0 focus-within:relative',
                day: 'h-8 w-8 p-0 font-normal rounded-lg hover:bg-dark-700 text-dark-200 hover:text-dark-100 flex items-center justify-center',
                day_selected: 'bg-primary-600 text-white hover:bg-primary-500 hover:text-white',
                day_today: 'bg-dark-700 text-dark-100 font-semibold',
                day_outside: 'text-dark-600 opacity-50',
                day_disabled: 'text-dark-600 opacity-30',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
