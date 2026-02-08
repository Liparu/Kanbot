import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  X,
  Calendar,
  MapPin,
  Users,
  Tag,
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
  Check,
  Pencil,
  ChevronDown,
  User,
  Clock,
  Bot,
  Timer,
} from 'lucide-react'
import { cardsApi, tagsApi } from '@/api/boards'
import { spacesApi } from '@/api/spaces'
import { useBoardStore } from '@/stores/boards'
import { getAvatarColor } from '@/utils/avatarColor'
import DateTimePicker from '@/components/common/DateTimePicker'
import { useToast } from '@/components/common/Toast'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { formatDateTime } from '@/utils/dateFormat'
import { useSettingsStore } from '@/stores/settings'
import type { Card, Task, Tag as TagType, SpaceMember } from '@/types'

interface CardDetailModalProps {
  cardId: string
  columnId: string
  spaceId: string
  onClose: () => void
}

export default function CardDetailModal({ cardId, columnId, spaceId, onClose }: CardDetailModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { columns, updateCard: updateCardInStore, removeCard } = useBoardStore()
  const { dateFormat } = useSettingsStore()

  const assigneeDropdownRef = useRef<HTMLDivElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)
  const isLocationUserEditRef = useRef(false)
  const lastSavedDescriptionRef = useRef<string>('')

  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [isDescriptionDirty, setIsDescriptionDirty] = useState(false)
  const [editedStartDate, setEditedStartDate] = useState('')
  const [editedEndDate, setEditedEndDate] = useState('')
  const [editedLocation, setEditedLocation] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)

  const [newTaskText, setNewTaskText] = useState('')
  const [newComment, setNewComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editedCommentContent, setEditedCommentContent] = useState('')

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setShowAssigneeDropdown(false)
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false)
      }
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: card, isLoading } = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => cardsApi.get(cardId),
  })

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId),
    enabled: !!spaceId,
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', spaceId],
    queryFn: () => tagsApi.list(spaceId),
    enabled: !!spaceId,
  })

  // Check if this card has an associated agent (for scheduled cards)
  const { data: cardAgent } = useQuery({
    queryKey: ['agent-by-card', cardId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/agents/by-card/${cardId}`, {
        headers: { 'X-API-Key': localStorage.getItem('apiKey') || '' },
      })
      if (!response.ok) return null
      return response.json()
    },
    enabled: !!cardId,
  })

  useEffect(() => {
    if (card) {
      setEditedName(card.name)
      // Only overwrite description if it's different from last saved value
      // This prevents race conditions where stale data overwrites user input
      if (card.description !== lastSavedDescriptionRef.current) {
        setEditedDescription(card.description || '')
        lastSavedDescriptionRef.current = card.description || ''
      }
      setEditedStartDate(card.start_date || '')
      setEditedEndDate(card.end_date || '')
      isLocationUserEditRef.current = false
      setEditedLocation(card.location || '')
      setLocationSuggestions([])
      setShowLocationSuggestions(false)
      setSelectedAssigneeIds(card.assignees?.map(a => a.id) || [])
      setSelectedTagIds(card.tags?.map(t => t.tag.id) || [])
    }
  }, [card])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Card> & { assignee_ids?: string[]; tag_ids?: string[] }) =>
      cardsApi.update(cardId, data),
    onSuccess: (updatedCard) => {
      // Reset dirty state FIRST to prevent useEffect race condition
      setIsDescriptionDirty(false)
      // Then update store and invalidate queries
      updateCardInStore(columnId, cardId, updatedCard)
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      queryClient.invalidateQueries({ queryKey: ['columns'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => cardsApi.delete(cardId),
    onSuccess: () => {
      removeCard(columnId, cardId)
      queryClient.invalidateQueries({ queryKey: ['columns'] })
      toast.success(t('cards.deleted'))
      onClose()
    },
    onError: () => {
      toast.error(t('common.operationFailed'))
    },
  })

  const handleDeleteCard = async () => {
    const confirmed = await confirm({
      title: t('common.deleteConfirmTitle'),
      message: t('cards.deleteConfirm'),
      confirmText: t('common.delete'),
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  const addTaskMutation = useMutation({
    mutationFn: (text: string) => cardsApi.addTask(cardId, { text }),
    onSuccess: (newTask) => {
      if (card) {
        const newTasks = [...(card.tasks || []), newTask]
        updateCardInStore(columnId, cardId, {
          tasks: newTasks,
          task_counter: (card.task_counter || 0) + 1,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      queryClient.invalidateQueries({ queryKey: ['columns'] })
      setNewTaskText('')
    },
  })

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      cardsApi.updateTask(cardId, taskId, { completed }),
    onSuccess: (_, vars) => {
      if (card) {
        const newTasks = card.tasks?.map((t) =>
          t.id === vars.taskId ? { ...t, completed: vars.completed } : t
        )
        const delta = vars.completed ? 1 : -1
        updateCardInStore(columnId, cardId, {
          tasks: newTasks,
          task_completed_counter: Math.max(0, (card.task_completed_counter || 0) + delta),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      queryClient.invalidateQueries({ queryKey: ['columns'] })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => cardsApi.deleteTask(cardId, taskId),
    onSuccess: (_, deletedTaskId) => {
      if (card) {
        const deletedTask = card.tasks?.find((t) => t.id === deletedTaskId)
        const newTasks = card.tasks?.filter((t) => t.id !== deletedTaskId)
        const newCounter = Math.max(0, (card.task_counter || 0) - 1)
        const completedDelta = deletedTask?.completed ? -1 : 0
        const newCompletedCounter = Math.max(0, (card.task_completed_counter || 0) + completedDelta)
        updateCardInStore(columnId, cardId, {
          tasks: newTasks,
          task_counter: newCounter,
          task_completed_counter: newCompletedCounter,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      queryClient.invalidateQueries({ queryKey: ['columns'] })
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => cardsApi.addComment(cardId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      setNewComment('')
    },
  })

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      cardsApi.updateComment(cardId, commentId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      setEditingCommentId(null)
      setEditedCommentContent('')
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => cardsApi.deleteComment(cardId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
    },
  })

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== card?.name) {
      updateMutation.mutate({ name: editedName.trim() })
    }
    setIsEditingName(false)
  }

  const handleSaveDescription = () => {
    if (editedDescription !== (card?.description || '')) {
      // Update ref BEFORE mutation to prevent race conditions
      lastSavedDescriptionRef.current = editedDescription
      updateMutation.mutate({ description: editedDescription })
    } else {
      // No change to save, reset dirty state immediately
      setIsDescriptionDirty(false)
    }
    setIsEditingDescription(false)
  }

  const handleDateChange = (field: 'start_date' | 'end_date', value: string | null, _isAllDay: boolean) => {
    if (field === 'start_date') {
      setEditedStartDate(value || '')
    } else {
      setEditedEndDate(value || '')
    }
    // Explicitly send null to clear dates, not undefined
    updateMutation.mutate({ [field]: value })
  }

  const handleLocationChange = () => {
    if (editedLocation !== (card?.location || '')) {
      updateMutation.mutate({ location: editedLocation || undefined })
    }
  }

  const handleLocationUserInput = (value: string) => {
    isLocationUserEditRef.current = true
    setEditedLocation(value)
  }

  useEffect(() => {
    if (!isLocationUserEditRef.current) return
    
    let timeout: number | undefined
    if (editedLocation.trim().length < 3) {
      setLocationSuggestions([])
      setShowLocationSuggestions(false)
      return
    }

    timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(editedLocation)}`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'Kanbot/1.0',
            },
          }
        )
        const data = await response.json()
        const suggestions = Array.isArray(data)
          ? data.map((item: any) => String(item.display_name)).filter(Boolean)
          : []
        setLocationSuggestions(suggestions)
        setShowLocationSuggestions(suggestions.length > 0)
      } catch {
        setLocationSuggestions([])
        setShowLocationSuggestions(false)
      }
    }, 300)

    return () => {
      if (timeout) window.clearTimeout(timeout)
    }
  }, [editedLocation])

  const handleToggleAssignee = (userId: string) => {
    const newAssignees = selectedAssigneeIds.includes(userId)
      ? selectedAssigneeIds.filter(id => id !== userId)
      : [...selectedAssigneeIds, userId]
    setSelectedAssigneeIds(newAssignees)
    updateMutation.mutate({ assignee_ids: newAssignees })
  }

  const handleToggleTag = (tagId: string) => {
    const newTags = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]
    setSelectedTagIds(newTags)
    updateMutation.mutate({ tag_ids: newTags })
  }

  if (isLoading || !card) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <div className="text-dark-400">{t('common.loading')}</div>
        </div>
      </div>
    )
  }

  const primaryTag = card.tags?.[0]?.tag
  const spaceMembers = space?.members || []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-dark-700 flex flex-col"
      >
        <div
          className="p-4 border-b border-dark-700 flex items-start justify-between"
          style={{ backgroundColor: primaryTag?.color ? `${primaryTag.color}20` : undefined }}
        >
          <div className="flex-1 mr-4">
            {/* Column location badge */}
            {(() => {
              const col = columns.find((c) => c.id === columnId)
              return col ? (
                <div className="text-xs text-primary-400 font-medium mb-1">
                  📍 {col.name}
                </div>
              ) : null
            })()}
            {isEditingName ? (
              <input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-xl font-bold"
                autoFocus
              />
            ) : (
              <h2
                className="text-xl font-bold text-dark-100 cursor-pointer hover:text-dark-200"
                onClick={() => setIsEditingName(true)}
              >
                {card.name}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteCard}
              className="p-2 text-dark-400 hover:text-red-400 rounded-lg hover:bg-dark-700"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-dark-300 mb-2">{t('cards.description')}</h3>
            {isEditingDescription ? (
              <div className="space-y-2">
                <textarea
                  value={editedDescription}
                  onChange={(e) => {
                    setEditedDescription(e.target.value)
                    // Mark as dirty immediately on first keystroke
                    if (!isDescriptionDirty) {
                      setIsDescriptionDirty(true)
                    }
                  }}
                  onBlur={handleSaveDescription}
                  rows={4}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                  placeholder={t('cards.description')}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingDescription(false)}
                    className="px-3 py-1 text-dark-400 hover:text-dark-100 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSaveDescription}
                    className="px-3 py-1 bg-primary-600 text-white rounded text-sm"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="text-dark-200 text-sm cursor-pointer hover:bg-dark-700 p-2 rounded-lg min-h-[60px] whitespace-pre-wrap"
                onClick={() => setIsEditingDescription(true)}
              >
                {card.description || t('cards.clickToAddDescription')}
              </p>
            )}
          </div>

          {/* Created by info */}
          <div className="flex items-center gap-4 text-sm text-dark-400">
            {card.creator && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{t('cards.createdBy')}</span>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                  style={{ backgroundColor: getAvatarColor(card.creator.username) }}
                >
                  {card.creator.username[0].toUpperCase()}
                </div>
                <span className="text-dark-200">{card.creator.username}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{t('cards.createdAt')}</span>
              <span className="text-dark-200">{formatDateTime(card.created_at, dateFormat, true, true)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('cards.startDate')}
              </label>
              <DateTimePicker
                value={editedStartDate}
                onChange={(value, isAllDay) => handleDateChange('start_date', value, isAllDay)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('cards.endDate')}
              </label>
              <DateTimePicker
                value={editedEndDate}
                onChange={(value, isAllDay) => handleDateChange('end_date', value, isAllDay)}
              />
            </div>
          </div>

          {/* Agent Schedule Info (for scheduled cards) */}
          {cardAgent && (
            <div className="bg-primary-900/20 border border-primary-500/30 rounded-lg p-4">
              <label className="text-sm font-medium text-primary-400 mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Scheduled Agent
              </label>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-dark-400">Model:</span>
                  <span className="ml-2 text-dark-200">{cardAgent.model?.split('/').pop() || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-dark-400">Schedule:</span>
                  <span className="ml-2 text-dark-200 font-mono">{cardAgent.schedule_value || 'N/A'}</span>
                </div>
                {cardAgent.last_run && (
                  <div>
                    <span className="text-dark-400">Last run:</span>
                    <span className="ml-2 text-dark-200">
                      {new Date(cardAgent.last_run).toLocaleString()}
                    </span>
                  </div>
                )}
                {cardAgent.next_run && (
                  <div>
                    <span className="text-dark-400">Next run:</span>
                    <span className="ml-2 text-dark-200">
                      {new Date(cardAgent.next_run).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              {cardAgent.enabled === false && (
                <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Agent is currently disabled
                </div>
              )}
            </div>
          )}

          <div className="relative" ref={locationRef}>
            <label className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {t('cards.location')}
            </label>
            <input
              type="text"
              value={editedLocation}
              onChange={(e) => handleLocationUserInput(e.target.value)}
              onBlur={handleLocationChange}
              placeholder={t('cards.locationPlaceholder')}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
            />
            {showLocationSuggestions && locationSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-dark-800 border border-dark-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {locationSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      isLocationUserEditRef.current = false
                      setEditedLocation(suggestion)
                      setShowLocationSuggestions(false)
                      setLocationSuggestions([])
                      updateMutation.mutate({ location: suggestion })
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={assigneeDropdownRef}>
            <label className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('cards.assignees')}
            </label>
            <button
              onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-left text-sm text-dark-100 flex items-center justify-between"
            >
              <span>
                {selectedAssigneeIds.length > 0
                  ? `${selectedAssigneeIds.length} ${t('cards.assigneesSelected')}`
                  : t('cards.selectAssignees')}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAssigneeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showAssigneeDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-dark-700 border border-dark-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {spaceMembers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-dark-400">{t('cards.noMembers')}</div>
                ) : (
                  spaceMembers.map((member: SpaceMember) => (
                    <button
                      key={member.user_id}
                      onClick={() => handleToggleAssignee(member.user_id)}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-dark-600 text-left"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedAssigneeIds.includes(member.user_id)
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-dark-500'
                      }`}>
                        {selectedAssigneeIds.includes(member.user_id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                        style={{ backgroundColor: getAvatarColor(member.username) }}
                      >
                        {member.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-dark-200">{member.username}</span>
                      <span className="text-xs text-dark-500">{member.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedAssigneeIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {spaceMembers
                  .filter((m: SpaceMember) => selectedAssigneeIds.includes(m.user_id))
                  .map((member: SpaceMember) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-2 px-2 py-1 bg-dark-700 rounded-full"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                        style={{ backgroundColor: getAvatarColor(member.username) }}
                      >
                        {member.username[0].toUpperCase()}
                      </div>
                      <span className="text-xs text-dark-200">{member.username}</span>
                      <button
                        onClick={() => handleToggleAssignee(member.user_id)}
                        className="text-dark-400 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="relative" ref={tagDropdownRef}>
            <label className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {t('cards.tags')}
            </label>
            <button
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-left text-sm text-dark-100 flex items-center justify-between"
            >
              <span>
                {selectedTagIds.length > 0
                  ? `${selectedTagIds.length} ${t('cards.tagsSelected')}`
                  : t('cards.selectTags')}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTagDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-dark-700 border border-dark-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {tags.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-dark-400">{t('cards.noTags')}</div>
                ) : (
                  tags.map((tag: TagType) => (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTag(tag.id)}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-dark-600 text-left"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedTagIds.includes(tag.id)
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-dark-500'
                      }`}>
                        {selectedTagIds.includes(tag.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-dark-200">{tag.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedTagIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags
                  .filter((t: TagType) => selectedTagIds.includes(t.id))
                  .map((tag: TagType) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                      style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => handleToggleTag(tag.id)}
                        className="hover:opacity-70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              {t('cards.tasks')} ({card.tasks?.filter((t: Task) => t.completed).length || 0}/{card.tasks?.length || 0})
            </h3>
            <div className="space-y-2">
              {card.tasks?.map((task: Task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 bg-dark-700 rounded-lg group"
                >
                  <button
                    onClick={() => toggleTaskMutation.mutate({ taskId: task.id, completed: !task.completed })}
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      task.completed
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-dark-500 hover:border-primary-500'
                    }`}
                  >
                    {task.completed && <Check className="w-3 h-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${task.completed ? 'text-dark-500 line-through' : 'text-dark-200'}`}>
                    {task.text}
                  </span>
                  <button
                    onClick={() => deleteTaskMutation.mutate(task.id)}
                    className="p-1 text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newTaskText.trim()) {
                    addTaskMutation.mutate(newTaskText.trim())
                  }
                }}
                className="flex gap-2"
              >
                <input
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder={t('cards.addTask')}
                  className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-dark-100"
                />
                <button
                  type="submit"
                  disabled={!newTaskText.trim()}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              {t('cards.comments')}
            </h3>
            <div className="space-y-3">
              {card.comments?.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 bg-dark-700 rounded-lg ${comment.is_deleted ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                        style={{ backgroundColor: getAvatarColor(
                          // Use username (matching kanban board) instead of actor_name for consistent colors
                          spaceMembers.find(m => m.user_id === comment.user_id)?.username || comment.actor_name || 'Unknown'
                        ) }}
                      >
                        {comment.actor_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-sm font-medium text-dark-200">{comment.actor_name}</span>
                      <span className="text-xs text-dark-500">
                        {formatDateTime(comment.created_at, dateFormat, true, true)}
                      </span>
                      {comment.is_edited && !comment.is_deleted && (
                        <span className="text-xs text-dark-500 italic">
                          ({t('common.edited')})
                        </span>
                      )}
                      {comment.is_deleted && (
                        <span className="text-xs text-red-400 italic">
                          ({t('common.deleted')})
                        </span>
                      )}
                    </div>
                    {!comment.is_deleted && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCommentId(comment.id)
                            setEditedCommentContent(comment.content)
                          }}
                          className="p-1 text-dark-400 hover:text-dark-200 rounded hover:bg-dark-600"
                          title={t('common.edit')}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                          className="p-1 text-dark-400 hover:text-red-400 rounded hover:bg-dark-600"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editedCommentContent}
                        onChange={(e) => setEditedCommentContent(e.target.value)}
                        className="flex-1 px-3 py-2 bg-dark-600 border border-dark-500 rounded-lg text-sm text-dark-100"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (editedCommentContent.trim()) {
                            updateCommentMutation.mutate({
                              commentId: comment.id,
                              content: editedCommentContent.trim(),
                            })
                          }
                        }}
                        disabled={!editedCommentContent.trim()}
                        className="px-2 py-1 bg-primary-600 text-white rounded text-sm disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCommentId(null)
                          setEditedCommentContent('')
                        }}
                        className="px-2 py-1 bg-dark-600 text-dark-300 rounded text-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className={`text-sm ${comment.is_deleted ? 'text-dark-500 italic' : 'text-dark-300'}`}>
                      {comment.content}
                    </p>
                  )}
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newComment.trim()) {
                    addCommentMutation.mutate(newComment.trim())
                  }
                }}
                className="flex gap-2"
              >
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('cards.addComment')}
                  className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-dark-100"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
