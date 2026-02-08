import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ChevronDown } from 'lucide-react'
import apiClient from '@/api/client'

interface Template {
  id: string
  name: string
  icon: string
  fields: {
    name: string
    description: string
    tag_names?: string[]
  }
}

interface TemplateSelectorProps {
  onSelect: (template: Template) => void
  onClear: () => void
  selectedTemplate: Template | null
}

export default function TemplateSelector({ onSelect, onClear, selectedTemplate }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['card-templates'],
    queryFn: async () => {
      const response = await apiClient.get('/templates/')
      return response.data
    },
    staleTime: 60000, // Cache for 1 minute
  })

  const handleSelect = (template: Template) => {
    onSelect(template)
    setIsOpen(false)
  }

  const handleClear = () => {
    onClear()
    setIsOpen(false)
  }

  return (
    <div className="relative mb-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-dark-600 border border-dark-500 rounded text-dark-300 hover:text-dark-100 hover:border-dark-400 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {selectedTemplate ? (
            <span className="text-dark-100">
              {selectedTemplate.icon} {selectedTemplate.name.replace(selectedTemplate.icon, '').trim()}
            </span>
          ) : (
            'Use template...'
          )}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && templates && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 w-full mt-1 bg-dark-700 border border-dark-500 rounded-lg shadow-xl overflow-hidden"
          >
            {selectedTemplate && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full px-3 py-2 text-sm text-left text-dark-400 hover:bg-dark-600 hover:text-dark-200 transition-colors border-b border-dark-600"
              >
                Clear template
              </button>
            )}
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelect(template)}
                className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-dark-200 hover:bg-dark-600'
                }`}
              >
                <span className="mr-2">{template.icon}</span>
                {template.name.replace(template.icon, '').trim()}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
