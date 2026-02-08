import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Bookmark, SlidersHorizontal, X, Save, Trash2, Tag, Calendar, Clock, Bot } from 'lucide-react'
import { motion } from 'framer-motion'
import { columnsApi, cardsApi, tagsApi } from '@/api/boards'
import { spacesApi } from '@/api/spaces'
import { filterTemplatesApi } from '@/api/filterTemplates'
import { useBoardStore } from '@/stores/boards'
import { getAvatarColor } from '@/utils/avatarColor'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import CardDetailModal from './CardDetailModal'
import ScheduledCards from './ScheduledCards'
import DatePicker from '@/components/common/DatePicker'
import ColorPicker from '@/components/common/ColorPicker'
import { useToast } from '@/components/common/Toast'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { Column, Card, ColumnCategory } from '@/types'

interface KanbanBoardProps {
  spaceId: string
}

export default function KanbanBoard({ spaceId }: KanbanBoardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { columns, setColumns, cards, setCards, addColumn, updateCard: updateCardInStore } = useBoardStore()
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [_isDraggingColumn, setIsDraggingColumn] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnCategory, setNewColumnCategory] = useState<ColumnCategory>('default')
  const previousCardsRef = useRef<Record<string, Card[]>>({})
  const previousMoveSourceRef = useRef<string | null>(null)

  const [filterSearch, setFilterSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [filterTag, setFilterTag] = useState<string>('')
  const [filterStartDateFrom, setFilterStartDateFrom] = useState('')
  const [filterStartDateTo, setFilterStartDateTo] = useState('')
  const [filterEndDateFrom, setFilterEndDateFrom] = useState('')
  const [filterEndDateTo, setFilterEndDateTo] = useState('')
  const [filterColumnId, setFilterColumnId] = useState<string>('')
  const [filterHasTasks, setFilterHasTasks] = useState(false)
  const [filterHasAssignees, setFilterHasAssignees] = useState(false)
  const [filterHasTags, setFilterHasTags] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const presetsRef = useRef<HTMLDivElement | null>(null)

  const [archiveExpanded, setArchiveExpanded] = useState(false)
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archiveAssignee, setArchiveAssignee] = useState<string>('')
  const [archiveTag, setArchiveTag] = useState<string>('')
  const [archiveYear, setArchiveYear] = useState<string>('')
  const [selectedCard, setSelectedCard] = useState<{ id: string; columnId: string } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showTagsDropdown, setShowTagsDropdown] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#ef4444')
  const tagsRef = useRef<HTMLDivElement | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'guest'>('member')
  const [showScheduledCards, setShowScheduledCards] = useState(false)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)

  useWebSocket(spaceId, {
    onMemberAdded: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] })
    },
    onTaskCreated: (cardId) => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
    },
    onTaskUpdated: (cardId) => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
    },
    onTaskDeleted: (cardId) => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
    },
    onCommentCreated: (cardId) => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
    },
    onCommentUpdated: (cardId) => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
    },
    onCommentDeleted: (cardId) => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
    },
    onTagCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', spaceId] })
    },
    onTagUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', spaceId] })
    },
    onTagDeleted: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', spaceId] })
    },
  })

  // Handle opening card from URL param (e.g., from notification click)
  useEffect(() => {
    const cardIdParam = searchParams.get('card')
    if (cardIdParam && cards && !selectedCard) {
      // Find the card's column
      for (const [columnId, columnCards] of Object.entries(cards)) {
        const foundCard = columnCards.find((c) => c.id === cardIdParam)
        if (foundCard) {
          setSelectedCard({ id: cardIdParam, columnId })
          // Clear the param from URL
          searchParams.delete('card')
          setSearchParams(searchParams, { replace: true })
          break
        }
      }
    }
  }, [searchParams, cards, selectedCard, setSearchParams])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const customCollisionDetection: CollisionDetection = (args) => {
    const { active } = args
    const activeId = active.id as string
    
    if (activeId.startsWith('column-')) {
      return closestCenter(args)
    }
    
    const pointerCollisions = pointerWithin(args)
    
    if (pointerCollisions.length > 0) {
      const cardCollision = pointerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'card'
      )
      if (cardCollision) {
        return [cardCollision]
      }
      const columnCollision = pointerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'column'
      )
      if (columnCollision) {
        return [columnCollision]
      }
    }
    
    const rectCollisions = rectIntersection(args)
    return rectCollisions.length > 0 ? [rectCollisions[0]] : []
  }

  const { data: filterTemplates = [] } = useQuery({
    queryKey: ['filter-templates', spaceId],
    queryFn: () => filterTemplatesApi.list(spaceId!),
    enabled: !!spaceId,
  })

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', spaceId],
    queryFn: () => tagsApi.list(spaceId!),
    enabled: !!spaceId,
  })
  
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: 'member' | 'guest' }) =>
      spacesApi.invite(spaceId!, data),
    onSuccess: () => {
      setInviteEmail('')
      setInviteRole('member')
      setShowInviteModal(false)
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] })
      toast.success(t('spaces.memberInvited'))
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || t('common.error'))
    },
  })

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; color: string; is_predefined?: boolean }) =>
      tagsApi.create(spaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', spaceId] })
      toast.success(t('tags.created'))
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || t('common.operationFailed')
      toast.error(errorMessage)
      console.error('Tag creation error:', error)
    },
  })

  const deleteTagMutation = useMutation({
    mutationFn: (tagId: string) => tagsApi.delete(tagId),
    onSuccess: (_, deletedTagId) => {
      if (filterTag === deletedTagId) {
        setFilterTag('')
      }
      if (archiveTag === deletedTagId) {
        setArchiveTag('')
      }
      queryClient.invalidateQueries({ queryKey: ['tags', spaceId] })
      queryClient.invalidateQueries({ queryKey: ['columns', spaceId] })
      toast.success(t('tags.deleted'))
    },
    onError: () => {
      toast.error(t('common.operationFailed'))
    },
  })

  const handleDeleteTag = async (tagId: string) => {
    const confirmed = await confirm({
      title: t('common.deleteConfirmTitle'),
      message: t('tags.deleteConfirm'),
      confirmText: t('common.delete'),
      variant: 'danger',
    })
    if (confirmed) {
      deleteTagMutation.mutate(tagId)
    }
  }

  useEffect(() => {
    if (!showTagsDropdown) return
    const handleClickAway = (event: MouseEvent) => {
      if (tagsRef.current && !tagsRef.current.contains(event.target as Node)) {
        setShowTagsDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [showTagsDropdown])

  const { data: fetchedColumns = [] } = useQuery({
    queryKey: ['columns', spaceId],
    queryFn: () => columnsApi.list(spaceId),
    enabled: !!spaceId,
  })

  useEffect(() => {
    if (fetchedColumns.length > 0) {
      setColumns(fetchedColumns)
      fetchedColumns.forEach((col) => {
        cardsApi.list({ column_id: col.id }).then((columnCards) => {
          setCards(col.id, columnCards)
        })
      })
    }
  }, [fetchedColumns, setColumns, setCards])

  useEffect(() => {
    if (!spaceId || filterTemplates.length === 0) return
    const stored = localStorage.getItem(`kanbot:defaultFilter:${spaceId}`)
    if (stored) {
      setSelectedPresetId(stored)
      const preset = filterTemplates.find((p) => p.id === stored)
      if (preset?.filters) {
        setFilterSearch(String(preset.filters.search || ''))
        setFilterAssignee(String(preset.filters.assignee || ''))
        setFilterTag(String(preset.filters.tag || ''))
        setFilterStartDateFrom(String(preset.filters.startDateFrom || ''))
        setFilterStartDateTo(String(preset.filters.startDateTo || ''))
        setFilterEndDateFrom(String(preset.filters.endDateFrom || ''))
        setFilterEndDateTo(String(preset.filters.endDateTo || ''))
        setFilterColumnId(String(preset.filters.columnId || ''))
        setFilterHasTasks(Boolean(preset.filters.hasTasks))
        setFilterHasAssignees(Boolean(preset.filters.hasAssignees))
        setFilterHasTags(Boolean(preset.filters.hasTags))
      }
    }
  }, [spaceId, filterTemplates])

  const createColumnMutation = useMutation({
    mutationFn: (data: { name: string; space_id: string; category: string }) =>
      columnsApi.create(data),
    onSuccess: (newColumn) => {
      addColumn(newColumn)
      setShowAddColumn(false)
      setNewColumnName('')
      setNewColumnCategory('default')
    },
    onError: () => {
      toast.error(t('common.operationFailed'))
    },
  })

  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, columnId, position }: { cardId: string; columnId: string; position?: number }) =>
      cardsApi.move(cardId, columnId, position),
    onSuccess: (updatedCard) => {
      const sourceColumnId = previousMoveSourceRef.current || updatedCard.column_id
      if (sourceColumnId !== updatedCard.column_id) {
        useBoardStore.getState().moveCard(
          sourceColumnId,
          updatedCard.column_id,
          updatedCard.id,
          updatedCard.position ?? 0
        )
      }
      updateCardInStore(updatedCard.column_id, updatedCard.id, updatedCard)
    },
    onError: () => {
      Object.entries(previousCardsRef.current).forEach(([columnId, columnCards]) => {
        setCards(columnId, columnCards)
      })
      toast.error(t('common.operationFailed'))
    },
  })

  const reorderColumnsMutation = useMutation({
    mutationFn: (columnIds: string[]) => columnsApi.reorder(columnIds),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', spaceId] })
      toast.error(t('common.operationFailed'))
    },
  })

  const toggleTaskMutation = useMutation({
    mutationFn: ({ cardId, taskId, completed }: { cardId: string; taskId: string; completed: boolean }) =>
      cardsApi.updateTask(cardId, taskId, { completed }),
    onSuccess: (_, vars) => {
      for (const columnId of Object.keys(cards)) {
        const card = cards[columnId]?.find((c) => c.id === vars.cardId)
        if (card) {
          const newTasks = card.tasks?.map((t) =>
            t.id === vars.taskId ? { ...t, completed: vars.completed } : t
          )
          const delta = vars.completed ? 1 : -1
          updateCardInStore(columnId, vars.cardId, {
            tasks: newTasks,
            task_completed_counter: Math.max(0, (card.task_completed_counter || 0) + delta),
          })
          break
        }
      }
      queryClient.invalidateQueries({ queryKey: ['columns', spaceId] })
      queryClient.invalidateQueries({ queryKey: ['card', vars.cardId] })
    },
  })

  const savePresetMutation = useMutation({
    mutationFn: (data: { name: string; filters: Record<string, unknown> }) =>
      filterTemplatesApi.create({
        space_id: spaceId!,
        name: data.name,
        filters: data.filters,
      }),
    onSuccess: (preset) => {
      setPresetName('')
      setSelectedPresetId(preset.id)
      if (spaceId) {
        localStorage.setItem(
          `kanbot:defaultFilter:${spaceId}`,
          preset.id
        )
      }
      queryClient.invalidateQueries({ queryKey: ['filter-templates', spaceId] })
    },
  })

  const deletePresetMutation = useMutation({
    mutationFn: (presetId: string) => filterTemplatesApi.delete(presetId),
    onSuccess: () => {
      setSelectedPresetId('')
      queryClient.invalidateQueries({ queryKey: ['filter-templates', spaceId] })
    },
  })

  useEffect(() => {
    if (!showPresets) return
    const handleClickAway = (event: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(event.target as Node)) {
        setShowPresets(false)
      }
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [showPresets])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const activeId = active.id as string

    if (activeId.startsWith('column-')) {
      setIsDraggingColumn(true)
    } else {
      for (const columnId of Object.keys(cards)) {
        const card = cards[columnId]?.find((c) => c.id === activeId)
        if (card) {
          setActiveCard(card)
          break
        }
      }
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setDragOverColumnId(null)
      return
    }

    const overId = over.id as string
    const overData = over.data.current as { type: string; columnId: string } | undefined

    if (overId.startsWith('column-')) {
      setDragOverColumnId(overId.replace('column-', ''))
    } else if (overData?.columnId) {
      setDragOverColumnId(overData.columnId)
    } else {
      setDragOverColumnId(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)
    setIsDraggingColumn(false)
    setDragOverColumnId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId.startsWith('column-') && overId.startsWith('column-')) {
      const activeColumnId = activeId.replace('column-', '')
      const overColumnId = overId.replace('column-', '')
      
      if (activeColumnId !== overColumnId) {
        const oldIndex = columns.findIndex((c) => c.id === activeColumnId)
        const newIndex = columns.findIndex((c) => c.id === overColumnId)
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newColumns = [...columns]
          const [movedColumn] = newColumns.splice(oldIndex, 1)
          newColumns.splice(newIndex, 0, movedColumn)
          setColumns(newColumns)
          reorderColumnsMutation.mutate(newColumns.map((c) => c.id))
        }
      }
      return
    }

    const cardId = activeId
    const activeData = active.data.current as { type: string; columnId: string } | undefined
    const overData = over.data.current as { type: string; columnId: string; cardId?: string } | undefined

    if (!activeData || activeData.type !== 'card') return

    const sourceColumnId = activeData.columnId

    let targetColumnId: string
    let targetPosition: number

    if (overData?.type === 'column') {
      targetColumnId = overData.columnId
      targetPosition = (cards[targetColumnId] || []).length
    } else if (overData?.type === 'card') {
      targetColumnId = overData.columnId
      const targetCards = cards[targetColumnId] || []
      const overCardIndex = targetCards.findIndex((c) => c.id === over.id)
      targetPosition = overCardIndex >= 0 ? overCardIndex : targetCards.length
    } else {
      return
    }

    if (sourceColumnId === targetColumnId && cardId === over.id) {
      return
    }

    previousMoveSourceRef.current = sourceColumnId
    previousCardsRef.current = {
      [sourceColumnId]: [...(cards[sourceColumnId] || [])],
      [targetColumnId]: [...(cards[targetColumnId] || [])],
    }

    useBoardStore.getState().moveCard(sourceColumnId, targetColumnId, cardId, targetPosition)
    moveCardMutation.mutate({ cardId, columnId: targetColumnId, position: targetPosition })
  }

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault()
    if (newColumnName.trim()) {
      createColumnMutation.mutate({
        name: newColumnName,
        space_id: spaceId,
        category: newColumnCategory,
      })
    }
  }

  return (
    <div className="h-full">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-dark-100">{space?.name || space?.name || ''}</h1>
            {space?.members && space.members.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex -space-x-2">
                  {space.members.slice(0, 5).map((member) => (
                    <div
                      key={member.user_id}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white border-2 border-dark-900 relative group"
                      style={{ backgroundColor: getAvatarColor(member.username) }}
                    >
                      {member.username[0].toUpperCase()}
                      <div className="absolute top-8 left-0 bg-dark-800 border border-dark-700 text-xs text-dark-100 rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] shadow-lg">
                        {member.username} ({member.email}) - {member.role}
                      </div>
                    </div>
                  ))}
                </div>
                {space.members.length > 5 && (
                  <span className="text-xs text-dark-400">+{space.members.length - 5}</span>
                )}
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-2 py-1 text-xs rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-white"
              >
                {t('spaces.inviteMember')}
              </button>
              <Link
                to={`/spaces/${spaceId}/calendar`}
                className="px-2 py-1 text-xs rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-white flex items-center gap-1"
              >
                <Calendar className="w-3 h-3" />
                {t('calendar.title')}
              </Link>
              {space?.type === 'agent' && (
                <Link
                  to={`/spaces/${spaceId}/dashboard`}
                  className="px-2 py-1 text-xs rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-white flex items-center gap-1"
                >
                  <Bot className="w-3 h-3" />
                  Dashboard
                </Link>
              )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder={t('filters.search')}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-100 focus:outline-none focus:border-primary-500 w-48"
            />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-100 focus:outline-none focus:border-primary-500"
            >
              <option value="">{t('filters.assignee')}</option>
              {Array.from(
                new Map(
                  Object.values(cards)
                    .flat()
                    .flatMap((c) => c.assignees || [])
                    .map((u) => [u.id, u])
                ).values()
              ).map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-100 focus:outline-none focus:border-primary-500"
            >
              <option value="">{t('filters.tag')}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
            <div className="relative" ref={tagsRef}>
              <button
                onClick={() => setShowTagsDropdown((v) => !v)}
                className={`px-3 py-2 text-sm rounded-lg border flex items-center gap-1 ${
                  showTagsDropdown ? 'bg-primary-600 text-white border-primary-600' : 'bg-dark-800 text-dark-300 border-dark-700'
                }`}
              >
                <Tag className="w-4 h-4" />
                {t('tags.manageTags')}
              </button>
              {showTagsDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full mt-1 right-0 w-64 bg-dark-800 border border-dark-700 rounded-lg shadow-lg z-20"
                >
                  <div className="p-2 border-b border-dark-700 space-y-2">
                    <div className="flex gap-2 items-center">
                      <input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder={t('tags.newTag')}
                        className="flex-1 px-2 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-xs text-dark-100"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <ColorPicker value={newTagColor} onChange={setNewTagColor} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!newTagName.trim() || !spaceId) return
                          createTagMutation.mutate({
                            name: newTagName.trim(),
                            color: newTagColor,
                            is_predefined: false,
                          })
                          setNewTagName('')
                        }}
                        className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        {t('common.create')}
                      </button>
                    </div>
                  </div>
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {tags.length === 0 && (
                      <span className="text-xs text-dark-500">{t('tags.empty')}</span>
                    )}
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-dark-700"
                      >
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteTag(tag.id)
                          }}
                          className="text-dark-500 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
            <button
              onClick={() => setShowScheduledCards(true)}
              className="px-3 py-2 text-sm rounded-lg border bg-dark-800 text-dark-300 border-dark-700 hover:bg-dark-700 flex items-center gap-1"
            >
              <Clock className="w-4 h-4" />
              {t('scheduledCards.title')}
            </button>
            <div className="relative" ref={presetsRef}>
              <button
                onClick={() => setShowPresets((v) => !v)}
                className={`px-3 py-2 text-sm rounded-lg border flex items-center gap-1 ${
                  selectedPresetId ? 'bg-primary-600 text-white border-primary-600' : 'bg-dark-800 text-dark-300 border-dark-700'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                {filterTemplates.find(p => p.id === selectedPresetId)?.name || t('filters.presets')}
              </button>
              {showPresets && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full mt-1 right-0 w-64 bg-dark-800 border border-dark-700 rounded-lg shadow-lg z-20"
                >
                  <div className="p-2 border-b border-dark-700">
                    <div className="flex gap-2">
                      <input
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder={t('filters.presetName')}
                        className="flex-1 px-2 py-1 bg-dark-900 border border-dark-600 rounded text-xs text-dark-100"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (presetName.trim()) {
                            savePresetMutation.mutate({
                              name: presetName,
                              filters: {
                                search: filterSearch,
                                assignee: filterAssignee,
                                tag: filterTag,
                                startDateFrom: filterStartDateFrom,
                                startDateTo: filterStartDateTo,
                                endDateFrom: filterEndDateFrom,
                                endDateTo: filterEndDateTo,
                                columnId: filterColumnId,
                                hasTasks: filterHasTasks,
                                hasAssignees: filterHasAssignees,
                                hasTags: filterHasTags,
                              },
                            })
                            setShowPresets(false)
                          }
                        }}
                        disabled={!presetName.trim()}
                        className="px-2 py-1 bg-primary-600 text-white rounded text-xs disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFilterSearch('')
                      setFilterAssignee('')
                      setFilterTag('')
                      setFilterStartDateFrom('')
                      setFilterStartDateTo('')
                      setFilterEndDateFrom('')
                      setFilterEndDateTo('')
                      setFilterColumnId('')
                      setFilterHasTasks(false)
                      setFilterHasAssignees(false)
                      setFilterHasTags(false)
                      setSelectedPresetId('')
                      setShowPresets(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-dark-400 hover:bg-dark-700 hover:text-dark-100 flex items-center gap-2"
                  >
                    <X className="w-3 h-3" />
                    {t('filters.clearAll')}
                  </button>
                  {filterTemplates.map((preset) => (
                    <div
                      key={preset.id}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center justify-between ${
                        selectedPresetId === preset.id ? 'text-primary-400' : 'text-dark-200'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedPresetId(preset.id)
                          if (preset.filters) {
                            setFilterSearch(String(preset.filters.search || ''))
                            setFilterAssignee(String(preset.filters.assignee || ''))
                            setFilterTag(String(preset.filters.tag || ''))
                            setFilterStartDateFrom(String(preset.filters.startDateFrom || ''))
                            setFilterStartDateTo(String(preset.filters.startDateTo || ''))
                            setFilterEndDateFrom(String(preset.filters.endDateFrom || ''))
                            setFilterEndDateTo(String(preset.filters.endDateTo || ''))
                            setFilterColumnId(String(preset.filters.columnId || ''))
                            setFilterHasTasks(Boolean(preset.filters.hasTasks))
                            setFilterHasAssignees(Boolean(preset.filters.hasAssignees))
                            setFilterHasTags(Boolean(preset.filters.hasTags))
                          }
                          setShowPresets(false)
                        }}
                        className="flex-1 text-left"
                      >
                        {preset.name}
                      </button>
                      <div className="flex items-center gap-2">
                        {selectedPresetId === preset.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (spaceId) {
                                localStorage.setItem(`kanbot:defaultFilter:${spaceId}`, preset.id)
                              }
                            }}
                            className="text-xs text-dark-400 hover:text-primary-400"
                            title={t('filters.setDefault')}
                          >
                            {t('filters.default')}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePresetMutation.mutate(preset.id)
                          }}
                          className="text-xs text-dark-500 hover:text-red-400"
                          title={t('filters.deletePreset')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
            <button
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className={`px-3 py-2 text-sm rounded-lg border flex items-center gap-1 ${
                (filterStartDateFrom || filterStartDateTo || filterEndDateFrom || filterEndDateTo)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-dark-800 text-dark-300 border-dark-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {t('filters.advanced')}
            </button>
            {spaceId && (
              <Link
                to={`/calendar?space=${spaceId}`}
                className="px-3 py-2 text-sm rounded-lg border flex items-center gap-1 bg-dark-800 text-dark-300 border-dark-700 hover:bg-dark-700 hover:text-dark-100"
              >
                <Calendar className="w-4 h-4" />
                {t('calendar.viewCalendar')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {showAdvancedFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 p-4 bg-dark-800 border border-dark-700 rounded-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-dark-100">{t('filters.dateRange')}</h3>
            <button
              onClick={() => setShowAdvancedFilters(false)}
              className="p-1 text-dark-400 hover:text-dark-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs text-dark-400 mb-1">{t('filters.column')}</label>
              <select
                value={filterColumnId}
                onChange={(e) => setFilterColumnId(e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-dark-100"
              >
                <option value="">{t('filters.any')}</option>
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-xs text-dark-300">
                <input
                  type="checkbox"
                  checked={filterHasTasks}
                  onChange={(e) => setFilterHasTasks(e.target.checked)}
                />
                {t('filters.hasTasks')}
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-xs text-dark-300">
                <input
                  type="checkbox"
                  checked={filterHasAssignees}
                  onChange={(e) => setFilterHasAssignees(e.target.checked)}
                />
                {t('filters.hasAssignees')}
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-xs text-dark-300">
                <input
                  type="checkbox"
                  checked={filterHasTags}
                  onChange={(e) => setFilterHasTags(e.target.checked)}
                />
                {t('filters.hasTags')}
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-dark-400 mb-1">{t('filters.startDateFrom')}</label>
              <DatePicker
                value={filterStartDateFrom}
                onChange={setFilterStartDateFrom}
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">{t('filters.startDateTo')}</label>
              <DatePicker
                value={filterStartDateTo}
                onChange={setFilterStartDateTo}
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">{t('filters.endDateFrom')}</label>
              <DatePicker
                value={filterEndDateFrom}
                onChange={setFilterEndDateFrom}
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">{t('filters.endDateTo')}</label>
              <DatePicker
                value={filterEndDateTo}
                onChange={setFilterEndDateTo}
              />
            </div>
          </div>
        </motion.div>
      )}


      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-260px)]">
          <SortableContext
            items={columns.map((c) => `column-${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => {
              const columnCards = cards[column.id] || []
              const filteredCards = columnCards.filter((card) => {
                if (filterSearch) {
                  const q = filterSearch.toLowerCase()
                  if (!card.name.toLowerCase().includes(q) && !(card.description || '').toLowerCase().includes(q)) {
                    return false
                  }
                }
                if (filterAssignee && !card.assignees?.some((u) => u.id === filterAssignee)) {
                  return false
                }
                if (filterTag && !card.tags?.some((t) => t.tag.id === filterTag)) {
                  return false
                }
                if (filterColumnId && card.column_id !== filterColumnId) {
                  return false
                }
                if (filterHasTasks && card.task_counter === 0) {
                  return false
                }
                if (filterHasAssignees && (!card.assignees || card.assignees.length === 0)) {
                  return false
                }
                if (filterHasTags && (!card.tags || card.tags.length === 0)) {
                  return false
                }
                if (filterStartDateFrom && card.start_date && new Date(card.start_date) < new Date(filterStartDateFrom)) {
                  return false
                }
                if (filterStartDateTo && card.start_date && new Date(card.start_date) > new Date(filterStartDateTo)) {
                  return false
                }
                if (filterEndDateFrom && card.end_date && new Date(card.end_date) < new Date(filterEndDateFrom)) {
                  return false
                }
                if (filterEndDateTo && card.end_date && new Date(card.end_date) > new Date(filterEndDateTo)) {
                  return false
                }
                return true
              })

              if (column.category === 'archive') {
                const archiveCards = filteredCards.filter((card) => {
                  if (archiveSearch) {
                    const q = archiveSearch.toLowerCase()
                    if (!card.name.toLowerCase().includes(q) && !(card.description || '').toLowerCase().includes(q)) {
                      return false
                    }
                  }
                  if (archiveAssignee && !card.assignees?.some((u) => u.id === archiveAssignee)) {
                    return false
                  }
                  if (archiveTag && !card.tags?.some((t) => t.tag.id === archiveTag)) {
                    return false
                  }
                  if (archiveYear && card.end_date) {
                    const cardYear = card.end_date.split('-')[0]
                    if (cardYear !== archiveYear) {
                      return false
                    }
                  }
                  return true
                })

                return (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={archiveCards}
                    spaceId={spaceId}
                    isDragOver={dragOverColumnId === column.id}
                    archiveExpanded={archiveExpanded}
                    onToggleArchive={() => setArchiveExpanded((v) => !v)}
                    onCardClick={(card) => setSelectedCard({ id: card.id, columnId: column.id })}
                    onToggleTask={(cardId, taskId, completed) =>
                      toggleTaskMutation.mutate({ cardId, taskId, completed })
                    }
                    archiveFilters={{
                      search: archiveSearch,
                      assignee: archiveAssignee,
                      tag: archiveTag,
                      year: archiveYear,
                      onSearch: setArchiveSearch,
                      onAssignee: setArchiveAssignee,
                      onTag: setArchiveTag,
                      onYear: setArchiveYear,
                    }}
                  />
                )
              }

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={filteredCards}
                  spaceId={spaceId}
                  isDragOver={dragOverColumnId === column.id}
                  onCardClick={(card) => setSelectedCard({ id: card.id, columnId: column.id })}
                  onToggleTask={(cardId, taskId, completed) =>
                    toggleTaskMutation.mutate({ cardId, taskId, completed })
                  }
                />
              )
            })}
          </SortableContext>

          {showAddColumn ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-shrink-0 w-80 bg-dark-800 rounded-xl p-4 border border-dark-700"
            >
              <form onSubmit={handleAddColumn} className="space-y-3">
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder={t('columns.columnName')}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                  autoFocus
                />
                <select
                  value={newColumnCategory}
                  onChange={(e) => setNewColumnCategory(e.target.value as ColumnCategory)}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                >
                  <option value="default">{t('columns.categories.default')}</option>
                  <option value="inbox">{t('columns.categories.inbox')}</option>
                  <option value="in_progress">{t('columns.categories.in_progress')}</option>
                  <option value="waiting">{t('columns.categories.waiting')}</option>
                  <option value="review">{t('columns.categories.review')}</option>
                  <option value="archive">{t('columns.categories.archive')}</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddColumn(false)}
                    className="flex-1 px-3 py-2 text-dark-400 hover:text-dark-100 text-sm transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-lg transition-colors"
                  >
                    {t('common.create')}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <button
              onClick={() => setShowAddColumn(true)}
              className="flex-shrink-0 w-80 h-12 flex items-center justify-center gap-2 bg-dark-800/50 hover:bg-dark-800 border border-dark-700 border-dashed rounded-xl text-dark-400 hover:text-dark-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('columns.createColumn')}
            </button>
          )}
        </div>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          keyframes({ transform }) {
            return [
              { transform: CSS.Transform.toString(transform.initial), opacity: 1 },
              { transform: CSS.Transform.toString(transform.final), opacity: 1 },
            ]
          },
        }}>
          {activeCard && <KanbanCard card={activeCard} isDragging />}
        </DragOverlay>
      </DndContext>

      {selectedCard && spaceId && (
        <CardDetailModal
          cardId={selectedCard.id}
          columnId={selectedCard.columnId}
          spaceId={spaceId}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-dark-100">{t('spaces.inviteMember')}</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-dark-400 hover:text-dark-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-300 mb-1">{t('auth.email')}</label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-dark-100"
                  placeholder="user@example.com"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-dark-300 mb-1">{t('spaces.members')}</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'member' | 'guest')}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-dark-100"
                >
                  <option value="member">Member</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-dark-300 hover:text-dark-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    if (!inviteEmail.trim()) return
                    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole })
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg"
                >
                  {t('spaces.inviteMember')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showScheduledCards && spaceId && (
        <ScheduledCards
          spaceId={spaceId}
          columns={columns}
          onClose={() => setShowScheduledCards(false)}
        />
      )}
    </div>
  )
}
