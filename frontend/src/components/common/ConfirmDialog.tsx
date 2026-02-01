import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return context.confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [state, setState] = useState<{
    isOpen: boolean
    options: ConfirmOptions | null
    resolve: ((value: boolean) => void) | null
  }>({
    isOpen: false,
    options: null,
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, options, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state.resolve?.(true)
    setState({ isOpen: false, options: null, resolve: null })
  }

  const handleCancel = () => {
    state.resolve?.(false)
    setState({ isOpen: false, options: null, resolve: null })
  }

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-500',
    warning: 'bg-yellow-600 hover:bg-yellow-500',
    default: 'bg-primary-600 hover:bg-primary-500',
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state.isOpen && state.options && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-dark-800 rounded-xl border border-dark-700 p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-600/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-dark-100 mb-2">
                    {state.options.title}
                  </h3>
                  <p className="text-dark-300 text-sm">
                    {state.options.message}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-dark-300 hover:text-dark-100 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                >
                  {state.options.cancelText || t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    variantStyles[state.options.variant || 'default']
                  }`}
                >
                  {state.options.confirmText || t('common.delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}
