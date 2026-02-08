import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, MoreVertical, Trash2, Archive, Clock, Inbox, CheckCircle, GripVertical } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cardsApi, columnsApi } from '@/api/boards'
import { useBoardStore } from '@/stores/boards'
import { useToast } from '@/components/common/Toast'
import { useConfirm } from '@/components/common/ConfirmDialog'
import KanbanCard from './KanbanCard'
import TemplateSelector from './TemplateSelector'
import type { Column, Card } from '@/types'

interface KanbanColumnProps {
  column: Column
  cards: Card[]
  spaceId?: string
  isDragOver?: boolean
  archiveExpanded?: boolean
  onToggleArchive?: () => void
  onCardClick?: (card: Card) => void
  onToggleTask?: (cardId: string, taskId: string, completed: boolean) => void
  archiveFilters?: {
    search: string
    assignee: string
    tag: string
    year: string
    onSearch: (value: string) => void
    onAssignee: (value: string) => void
    onTag: (value: string) => void
    onYear: (value: string) => void
  }
}

const categoryIcons = {
  default: null,
  inbox: <Inbox className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4" />,
  waiting: <Clock className="w-4 h-4" />,
  review: <CheckCircle className="w-4 h-4" />,
  archive: <Archive className="w-4 h-4" />,
}

const categoryColors = {
  default: 'border-dark-600',
  inbox: 'border-blue-500/50',
  in_progress: 'border-yellow-500/50',
  waiting: 'border-orange-500/50',
  review: 'border-purple-500/50',
  archive: 'border-dark-500',
}

export default function KanbanColumn({
  column,
  cards,
  spaceId,
  isDragOver = false,
  archiveExpanded = true,
  onToggleArchive,
  onCardClick,
  archiveFilters,
  onToggleTask,
}: KanbanColumnProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { addCard, removeColumn } = useBoardStore()
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardName, setNewCardName] = useState('')
  const [newCardDescription, setNewCardDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string
    name: string
    icon: string
    fields: { name: string; description: string; tag_names?: string[] }
  } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const addCardRef = useRef<HTMLDivElement>(null)
  const isInitialMount = useRef(true)

  useEffect(() => {
    isInitialMount.current = false
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addCardRef.current && !addCardRef.current.contains(event.target as Node)) {
        setShowAddCard(false)
        setNewCardName('')
        setNewCardDescription('')
        setSelectedTemplate(null)
      }
    }
    if (showAddCard) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddCard])

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id },
  })

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  })

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const createCardMutation = useMutation({
    mutationFn: (data: { column_id: string; name: string; description?: string; tag_names?: string[]; start_date: string }) => cardsApi.create(data),
    onSuccess: (newCard) => {
      addCard(column.id, newCard)
      setShowAddCard(false)
      setNewCardName('')
      setNewCardDescription('')
      setSelectedTemplate(null)
      if (onCardClick) {
        queryClient.setQueryData(['card', newCard.id], newCard)
        onCardClick(newCard)
      }
    },
    onError: () => {
      toast.error(t('common.operationFailed'))
    },
  })

  const deleteColumnMutation = useMutation({
    mutationFn: () => columnsApi.delete(column.id),
    onSuccess: () => {
      removeColumn(column.id)
      queryClient.invalidateQueries({ queryKey: ['columns'] })
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: ['space-stats', spaceId] })
      }
      toast.success(t('columns.deleted'))
    },
    onError: () => {
      toast.error(t('common.operationFailed'))
    },
  })

  const handleDeleteColumn = async () => {
    const confirmed = await confirm({
      title: t('common.deleteConfirmTitle'),
      message: t('columns.deleteConfirm'),
      confirmText: t('common.delete'),
      variant: 'danger',
    })
    if (confirmed) {
      deleteColumnMutation.mutate()
    }
    setShowMenu(false)
  }

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCardName.trim()) {
      createCardMutation.mutate({
        column_id: column.id,
        name: newCardName,
        description: newCardDescription || undefined,
        tag_names: selectedTemplate?.fields.tag_names,
        start_date: new Date().toISOString(),
      })
    }
  }

  const handleTemplateSelect = (template: typeof selectedTemplate) => {
    setSelectedTemplate(template)
    if (template) {
      setNewCardName(template.fields.name)
      setNewCardDescription(template.fields.description)
    }
  }

  const handleTemplateClear = () => {
    setSelectedTemplate(null)
    setNewCardName('')
    setNewCardDescription('')
  }

  const showArchiveFilters = column.category === 'archive'
  const isArchive = column.category === 'archive'

  return (
    <motion.div
      ref={setSortableRef}
      style={sortableStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex-shrink-0 h-full ${isArchive ? 'w-64' : 'w-80'} ${isColumnDragging ? 'opacity-50' : ''}`}
    >
      <div
        ref={setDroppableRef}
        className={`h-full bg-dark-800 rounded-xl border-2 ${
          isDragOver ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/20' : categoryColors[column.category]
        } flex flex-col transition-all duration-150 ${isArchive ? 'opacity-80' : ''}`}
      >
        <div className="p-3 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="p-1 cursor-grab active:cursor-grabbing text-dark-500 hover:text-dark-300 -ml-1"
            >
              <GripVertical className="w-4 h-4" />
            </button>
            {categoryIcons[column.category]}
            <h3 className="font-medium text-dark-100">{column.name}</h3>
            <span className="text-xs text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full">
              {cards.length}
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-dark-400 hover:text-dark-100 rounded hover:bg-dark-700"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-dark-700 rounded-lg shadow-lg border border-dark-600 py-1 z-10"
                >
                  <button
                    onClick={handleDeleteColumn}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-dark-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('common.delete')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      {showArchiveFilters && (
        <div className="px-3 py-2 border-b border-dark-700 space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={onToggleArchive}
              className="text-xs text-dark-400 hover:text-dark-100"
            >
              {archiveExpanded ? t('archive.collapse') : t('archive.expand')}
            </button>
            <span className="text-xs text-dark-500">{cards.length}</span>
          </div>
          {archiveExpanded && archiveFilters && (
            <>
              <input
                value={archiveFilters.search}
                onChange={(e) => archiveFilters.onSearch(e.target.value)}
                placeholder={t('archive.filter')}
                className="w-full px-2 py-1 text-xs bg-dark-700 border border-dark-600 rounded text-dark-100"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={archiveFilters.year}
                  onChange={(e) => archiveFilters.onYear(e.target.value)}
                  className="px-2 py-1 text-xs bg-dark-700 border border-dark-600 rounded text-dark-100"
                >
                  <option value="">{t('filters.year')}</option>
                  {Array.from(
                    new Set(
                      cards
                        .filter((c) => c.end_date)
                        .map((c) => c.end_date!.split('-')[0])
                    )
                  ).sort((a, b) => b.localeCompare(a)).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  value={archiveFilters.assignee}
                  onChange={(e) => archiveFilters.onAssignee(e.target.value)}
                  className="px-2 py-1 text-xs bg-dark-700 border border-dark-600 rounded text-dark-100"
                >
                  <option value="">{t('filters.assignee')}</option>
                  {Array.from(
                    new Map(
                      cards
                        .flatMap((c) => c.assignees || [])
                        .map((u) => [u.id, u])
                    ).values()
                  ).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
                <select
                  value={archiveFilters.tag}
                  onChange={(e) => archiveFilters.onTag(e.target.value)}
                  className="px-2 py-1 text-xs bg-dark-700 border border-dark-600 rounded text-dark-100"
                >
                  <option value="">{t('filters.tag')}</option>
                  {Array.from(
                    new Map(
                      cards
                        .flatMap((c) => c.tags || [])
                        .map((t) => [t.tag.id, t.tag])
                    ).values()
                  ).map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${showArchiveFilters && !archiveExpanded ? 'hidden' : ''}`}>
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={isInitialMount.current ? { opacity: 0, y: -30 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: isInitialMount.current ? index * 0.05 : 0,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <KanbanCard
                card={card}
                onClick={() => onCardClick?.(card)}
                onToggleTask={(taskId, completed) => onToggleTask?.(card.id, taskId, completed)}
              />
            </motion.div>
          ))}
        </SortableContext>

        <AnimatePresence mode="wait">
          {!isArchive && showAddCard ? (
            <motion.div 
              key="add-form"
              ref={addCardRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <form
                onSubmit={handleAddCard}
                className="bg-dark-700 rounded-lg p-3 space-y-2"
              >
                <TemplateSelector
                  onSelect={handleTemplateSelect}
                  onClear={handleTemplateClear}
                  selectedTemplate={selectedTemplate}
                />
                <input
                  type="text"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  placeholder={selectedTemplate ? `${selectedTemplate.icon} ${t('cards.cardName')}` : t('cards.cardName')}
                  className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCard(false)}
                    className="flex-1 px-3 py-1.5 text-dark-400 hover:text-dark-100 text-sm transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded transition-colors"
                  >
                    {t('common.create')}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : !isArchive ? (
            <motion.button
              key="add-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowAddCard(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-dark-400 hover:text-dark-200 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('cards.createCard')}
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
      </div>
    </motion.div>
  )
}
