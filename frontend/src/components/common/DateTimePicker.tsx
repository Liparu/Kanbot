import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid, parseISO } from 'date-fns'
import { Calendar, X, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '@/stores/settings'
import { getDateFnsFormat, getPlaceholder, getDatePart, getTimePart, createISODateTime } from '@/utils/dateFormat'

interface DateTimePickerProps {
  value: string | null | undefined  // ISO datetime string or null
  onChange: (value: string | null, isAllDay: boolean) => void
  placeholder?: string
  className?: string
}

export default function DateTimePicker({ value, onChange, placeholder, className = '' }: DateTimePickerProps) {
  const { t } = useTranslation()
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const dateFnsFormat = getDateFnsFormat(dateFormat)
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Determine if this is an all-day event (no time or time is 00:00)
  const isAllDay = !value || (() => {
    const date = parseISO(value)
    if (!isValid(date)) return true
    return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
  })()

  // Separate state for date and time
  const [datePart, setDatePart] = useState<string>(value ? getDatePart(value) : '')
  const [timePart, setTimePart] = useState<string | null>(value && !isAllDay ? getTimePart(value) : null)
  const [isAllDayState, setIsAllDayState] = useState(isAllDay)

  useEffect(() => {
    if (value) {
      const date = parseISO(value)
      if (isValid(date)) {
        setInputValue(format(date, isAllDay ? dateFnsFormat : `${dateFnsFormat} HH:mm`))
        setDatePart(getDatePart(value))
        setTimePart(isAllDay ? null : getTimePart(value))
      }
    } else {
      setInputValue('')
      setDatePart('')
      setTimePart(null)
    }
    setIsAllDayState(isAllDay)
  }, [value, dateFnsFormat, isAllDay])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDateSelect = (day: Date | undefined) => {
    if (day) {
      const newDatePart = format(day, 'yyyy-MM-dd')
      setDatePart(newDatePart)
      
      // Emit the change immediately
      if (isAllDayState) {
        const isoString = createISODateTime(newDatePart, null)
        onChange(isoString, true)
        setInputValue(format(day, dateFnsFormat))
      } else {
        const timeToUse = timePart || '09:00'
        setTimePart(timeToUse)
        const isoString = createISODateTime(newDatePart, timeToUse)
        onChange(isoString, false)
        setInputValue(`${format(day, dateFnsFormat)} ${timeToUse}`)
      }
      setIsOpen(false)
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTimePart(newTime)
    if (datePart) {
      const isoString = createISODateTime(datePart, newTime)
      onChange(isoString, false)
      const date = parse(datePart, 'yyyy-MM-dd', new Date())
      if (isValid(date)) {
        setInputValue(`${format(date, dateFnsFormat)} ${newTime}`)
      }
    }
  }

  const handleHourChange = (newHour: string) => {
    const currentMinute = timePart ? timePart.split(':')[1] : '00'
    const newTime = `${newHour.padStart(2, '0')}:${currentMinute}`
    handleTimeChange(newTime)
  }

  const handleMinuteChange = (newMinute: string) => {
    const currentHour = timePart ? timePart.split(':')[0] : '09'
    const newTime = `${currentHour}:${newMinute.padStart(2, '0')}`
    handleTimeChange(newTime)
  }

  const handleAllDayToggle = (allDay: boolean) => {
    setIsAllDayState(allDay)
    
    if (allDay) {
      // Switching to all-day: remove time
      if (datePart) {
        const isoString = createISODateTime(datePart, null)
        onChange(isoString, true)
        const date = parse(datePart, 'yyyy-MM-dd', new Date())
        if (isValid(date)) {
          setInputValue(format(date, dateFnsFormat))
        }
      }
    } else {
      // Switching to timed: add default time
      const defaultTime = timePart || '09:00'
      setTimePart(defaultTime)
      if (datePart) {
        const isoString = createISODateTime(datePart, defaultTime)
        onChange(isoString, false)
        const date = parse(datePart, 'yyyy-MM-dd', new Date())
        if (isValid(date)) {
          setInputValue(`${format(date, dateFnsFormat)} ${defaultTime}`)
        }
      }
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null, true)
    setInputValue('')
    setDatePart('')
    setTimePart(null)
  }

  const selectedDate = datePart ? parse(datePart, 'yyyy-MM-dd', new Date()) : undefined

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  
  // Generate minute options (0-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

  const currentHour = timePart ? timePart.split(':')[0] : '09'
  const currentMinute = timePart ? timePart.split(':')[1] : '00'

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          readOnly
          onClick={() => setIsOpen(!isOpen)}
          placeholder={placeholder || getPlaceholder(dateFormat)}
          className="w-full px-3 py-2 pr-16 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500 cursor-pointer"
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
            className="absolute z-50 mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl p-4 min-w-[320px]"
          >
            {/* All Day Toggle */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-dark-700">
              <span className="text-sm text-dark-300">{t('calendar.allDay')}</span>
              <button
                type="button"
                onClick={() => handleAllDayToggle(!isAllDayState)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isAllDayState ? 'bg-primary-600' : 'bg-dark-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    isAllDayState ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Calendar */}
            <div className="mb-3">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                showOutsideDays
                fixedWeeks
                formatters={{
                  formatCaption: (date) => format(date, 'MMMM yyyy'),
                }}
                classNames={{
                  root: 'p-0',
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
            </div>

            {/* Time Selector - Hour and Minute */}
            {!isAllDayState && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 border-t border-dark-700"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-dark-400" />
                  <div className="flex items-center gap-2 flex-1">
                    {/* Hour selector */}
                    <select
                      value={currentHour}
                      onChange={(e) => handleHourChange(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-sm text-dark-100 focus:outline-none focus:border-primary-500"
                    >
                      {hourOptions.map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <span className="text-dark-400">:</span>
                    {/* Minute selector */}
                    <select
                      value={currentMinute}
                      onChange={(e) => handleMinuteChange(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-sm text-dark-100 focus:outline-none focus:border-primary-500"
                    >
                      {minuteOptions.map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
