import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#64748b', '#1e293b',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

export default function ColorPicker({ value, onChange, className = '' }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="w-10 h-8 rounded-lg border-2 border-dark-600 hover:border-dark-500 transition-colors shadow-inner"
        style={{ backgroundColor: value }}
      />
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            className="absolute top-full mt-2 left-0 bg-dark-800 border border-dark-700 rounded-xl shadow-xl p-3 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-5 gap-2 mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onChange(color)
                    setIsOpen(false)
                  }}
                  className={`w-7 h-7 rounded-lg transition-all hover:scale-110 ${
                    value === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-dark-700">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                    onChange(e.target.value)
                  }
                }}
                className="flex-1 px-2 py-1 bg-dark-900 border border-dark-600 rounded text-xs text-dark-100 font-mono uppercase"
                maxLength={7}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
