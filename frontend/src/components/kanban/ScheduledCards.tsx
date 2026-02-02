import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Play, Pause, Clock, Calendar } from 'lucide-react'
import { scheduledCardsApi, tagsApi, ScheduledCard, ScheduledCardCreate } from '@/api/boards'
import { spacesApi } from '@/api/spaces'
import DateTimePicker from '@/components/common/DateTimePicker'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/dateFormat'
import type { Column, Tag } from '@/types'

interface ScheduledCardsProps {
  spaceId: string
  columns: Column[]
  onClose: () => void
}

const INTERVAL_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const

export default function ScheduledCards({ spaceId, columns, onClose }: ScheduledCardsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const dateFormat = useSettingsStore((s) => s.dateFormat)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [columnName, setColumnName] = useState(columns[0]?.name || '')
  const [columnId, setColumnId] = useState(columns[0]?.id || '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [interval, setInterval] = useState<ScheduledCardCreate['interval']>('weekly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [tasks, setTasks] = useState<string[]>([])
  const [newTask, setNewTask] = useState('')

  const { data: scheduledCards = [], isLoading } = useQuery({
    queryKey: ['scheduled-cards', spaceId],
    queryFn: () => scheduledCardsApi.list(spaceId, false),
    enabled: !!spaceId,
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', spaceId],
    queryFn: () => tagsApi.list(spaceId),
    enabled: !!spaceId,
  })

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId),
    enabled: !!spaceId,
  })

  const createMutation = useMutation({
    mutationFn: (data: ScheduledCardCreate) => scheduledCardsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-cards', spaceId] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduledCardCreate> & { active?: boolean } }) =>
      scheduledCardsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-cards', spaceId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduledCardsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-cards', spaceId] })
    },
  })

  const triggerMutation = useMutation({
    mutationFn: (id: string) => scheduledCardsApi.trigger(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns'] })
    },
  })

  const resetForm = () => {
    setShowCreateForm(false)
    setColumnName(columns[0]?.name || '')
    setColumnId(columns[0]?.id || '')
    setName('')
    setDescription('')
    setInterval('weekly')
    setStartDate('')
    setEndDate('')
    setLocation('')
    setSelectedTagIds([])
    setSelectedAssigneeIds([])
    setTasks([])
    setNewTask('')
  }

  const handleCreate = () => {
    if (!name.trim() || !columnName.trim() || !startDate) return

    createMutation.mutate({
      space_id: spaceId,
      column_id: columnId || undefined,
      column_name: columnName,
      name: name.trim(),
      description: description.trim() || undefined,
      interval,
      start_date: startDate,
      end_date: endDate || undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      assignee_ids: selectedAssigneeIds.length > 0 ? selectedAssigneeIds : undefined,
      tasks: tasks.length > 0 ? tasks : undefined,
      location: location.trim() || undefined,
    })
  }

  const handleAddTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, newTask.trim()])
      setNewTask('')
    }
  }

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
  }

  const handleColumnChange = (colId: string) => {
    setColumnId(colId)
    const col = columns.find((c) => c.id === colId)
    if (col) {
      setColumnName(col.name)
    }
  }

  const spaceMembers = space?.members || []
  const nonArchiveColumns = columns.filter((c) => c.category !== 'archive')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 rounded-xl w-full max-w-3xl max-h-[90vh] min-h-[600px] overflow-hidden border border-dark-700 flex flex-col"
      >
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-dark-100">{t('scheduledCards.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {showCreateForm ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-dark-200">{t('scheduledCards.createNew')}</h3>
                  <button
                    onClick={resetForm}
                    className="text-sm text-dark-400 hover:text-dark-100"
                  >
                    {t('common.cancel')}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">{t('scheduledCards.cardName')}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('scheduledCards.cardNamePlaceholder')}
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">{t('scheduledCards.targetColumn')}</label>
                    <select
                      value={columnId}
                      onChange={(e) => handleColumnChange(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                    >
                      {nonArchiveColumns.map((col) => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                      <option value="">{t('scheduledCards.customColumn')}</option>
                    </select>
                    {!columnId && (
                      <input
                        type="text"
                        value={columnName}
                        onChange={(e) => setColumnName(e.target.value)}
                        placeholder={t('scheduledCards.columnNamePlaceholder')}
                        className="w-full px-3 py-2 mt-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.description')}</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('scheduledCards.descriptionPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.location')}</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t('cards.locationPlaceholder')}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">{t('scheduledCards.interval')}</label>
                    <select
                      value={interval}
                      onChange={(e) => setInterval(e.target.value as ScheduledCardCreate['interval'])}
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div></div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">{t('scheduledCards.startDate')}</label>
                    <DateTimePicker
                      value={startDate}
                      onChange={(value) => setStartDate(value || '')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">{t('scheduledCards.endDate')}</label>
                    <DateTimePicker
                      value={endDate}
                      onChange={(value) => setEndDate(value || '')}
                      placeholder={t('scheduledCards.optional')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.tags')}</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: Tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagIds(
                          selectedTagIds.includes(tag.id)
                            ? selectedTagIds.filter((id) => id !== tag.id)
                            : [...selectedTagIds, tag.id]
                        )}
                        className={`px-3 py-1 rounded-full text-xs ${selectedTagIds.includes(tag.id) ? 'ring-2 ring-primary-500' : ''}`}
                        style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.assignees')}</label>
                  <div className="flex flex-wrap gap-2">
                    {spaceMembers.map((member) => (
                      <button
                        key={member.user_id}
                        onClick={() => setSelectedAssigneeIds(
                          selectedAssigneeIds.includes(member.user_id)
                            ? selectedAssigneeIds.filter((id) => id !== member.user_id)
                            : [...selectedAssigneeIds, member.user_id]
                        )}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                          selectedAssigneeIds.includes(member.user_id)
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-700 text-dark-300'
                        }`}
                      >
                        <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-[10px]">
                          {member.username[0].toUpperCase()}
                        </div>
                        {member.username}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">{t('scheduledCards.tasks')}</label>
                  <div className="space-y-2">
                    {tasks.map((task, index) => (
                      <div key={index} className="flex items-center gap-2 bg-dark-700 rounded px-3 py-2">
                        <span className="flex-1 text-sm text-dark-200">{task}</span>
                        <button
                          onClick={() => handleRemoveTask(index)}
                          className="text-dark-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        placeholder={t('scheduledCards.addTaskPlaceholder')}
                        className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
                      />
                      <button
                        onClick={handleAddTask}
                        className="px-3 py-2 bg-dark-600 text-dark-300 rounded hover:text-dark-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleCreate}
                    disabled={!name.trim() || !columnName.trim() || !startDate || createMutation.isPending}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {t('scheduledCards.create')}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full mb-4 flex items-center justify-center gap-2 py-3 border border-dark-600 border-dashed rounded-lg text-dark-400 hover:text-dark-100 hover:border-dark-500"
                >
                  <Plus className="w-4 h-4" />
                  {t('scheduledCards.createNew')}
                </button>

                {isLoading ? (
                  <div className="text-center py-8 text-dark-500">{t('common.loading')}</div>
                ) : scheduledCards.length === 0 ? (
                  <div className="text-center py-8 text-dark-500">{t('scheduledCards.empty')}</div>
                ) : (
                  <div className="space-y-3">
                    {scheduledCards.map((card: ScheduledCard) => (
                      <div
                        key={card.id}
                        className={`bg-dark-700 rounded-lg p-4 ${!card.active ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-dark-100">{card.name}</h4>
                            <div className="text-xs text-dark-400 mt-1">
                              {t('scheduledCards.inColumn', { column: card.column_name })} • {INTERVAL_OPTIONS.find((o) => o.value === card.interval)?.label}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => triggerMutation.mutate(card.id)}
                              className="p-1.5 text-dark-400 hover:text-primary-400 rounded hover:bg-dark-600"
                              title={t('scheduledCards.triggerNow')}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateMutation.mutate({ id: card.id, data: { active: !card.active } })}
                              className={`p-1.5 rounded hover:bg-dark-600 ${card.active ? 'text-dark-400 hover:text-yellow-400' : 'text-yellow-500'}`}
                              title={card.active ? t('scheduledCards.pause') : t('scheduledCards.resume')}
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(card.id)}
                              className="p-1.5 text-dark-400 hover:text-red-400 rounded hover:bg-dark-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-dark-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {t('scheduledCards.nextRun')}: {formatDate(card.next_run, dateFormat)}
                          </span>
                          {card.last_run && (
                            <span>
                              {t('scheduledCards.lastRun')}: {formatDate(card.last_run, dateFormat)}
                            </span>
                          )}
                          {card.end_date && (
                            <span>
                              {t('scheduledCards.until')}: {formatDate(card.end_date, dateFormat)}
                            </span>
                          )}
                        </div>
                        {card.description && (
                          <p className="text-sm text-dark-300 mt-2">{card.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
