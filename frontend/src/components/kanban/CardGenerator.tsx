import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { X, Wand2, Plus, Trash2 } from 'lucide-react'
import { cardsApi, tagsApi } from '@/api/boards'
import { spacesApi } from '@/api/spaces'
import { useBoardStore } from '@/stores/boards'
import { getAvatarColor } from '@/utils/avatarColor'
import type { Column, Tag } from '@/types'

interface CardGeneratorProps {
  spaceId: string
  columns: Column[]
  onClose: () => void
}

interface CardTemplate {
  name: string
  description: string
  tagIds: string[]
  assigneeIds: string[]
}

export default function CardGenerator({ spaceId, columns, onClose }: CardGeneratorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { addCard } = useBoardStore()

  const [targetColumnId, setTargetColumnId] = useState(columns[0]?.id || '')
  const [cardCount, setCardCount] = useState(1)
  const [namePattern, setNamePattern] = useState('Card {n}')
  const [description, setDescription] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [customCards, setCustomCards] = useState<CardTemplate[]>([])
  const [mode, setMode] = useState<'pattern' | 'custom'>('pattern')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)

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

  const createCardMutation = useMutation({
    mutationFn: (data: { column_id: string; name: string; description?: string; tag_ids?: string[]; assignee_ids?: string[] }) =>
      cardsApi.create(data),
    onSuccess: (newCard) => {
      addCard(newCard.column_id, newCard)
      setGeneratedCount((c) => c + 1)
    },
  })

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGeneratedCount(0)

    try {
      if (mode === 'pattern') {
        for (let i = 1; i <= cardCount; i++) {
          const name = namePattern.replace(/{n}/g, String(i)).replace(/{N}/g, String(i))
          await createCardMutation.mutateAsync({
            column_id: targetColumnId,
            name,
            description: description || undefined,
            tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
            assignee_ids: selectedAssigneeIds.length > 0 ? selectedAssigneeIds : undefined,
          })
        }
      } else {
        for (const card of customCards) {
          await createCardMutation.mutateAsync({
            column_id: targetColumnId,
            name: card.name,
            description: card.description || undefined,
            tag_ids: card.tagIds.length > 0 ? card.tagIds : undefined,
            assignee_ids: card.assigneeIds.length > 0 ? card.assigneeIds : undefined,
          })
        }
      }

      queryClient.invalidateQueries({ queryKey: ['columns'] })
      onClose()
    } catch (error) {
      console.error('Failed to generate cards:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAddCustomCard = () => {
    setCustomCards([...customCards, { name: '', description: '', tagIds: [], assigneeIds: [] }])
  }

  const handleRemoveCustomCard = (index: number) => {
    setCustomCards(customCards.filter((_, i) => i !== index))
  }

  const handleUpdateCustomCard = (index: number, updates: Partial<CardTemplate>) => {
    setCustomCards(customCards.map((card, i) => (i === index ? { ...card, ...updates } : card)))
  }

  const spaceMembers = space?.members || []
  const nonArchiveColumns = columns.filter((c) => c.category !== 'archive')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-dark-700 flex flex-col"
      >
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-dark-100">{t('cards.cardGenerator')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">{t('cards.targetColumn')}</label>
            <select
              value={targetColumnId}
              onChange={(e) => setTargetColumnId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
            >
              {nonArchiveColumns.map((col) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMode('pattern')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm ${
                mode === 'pattern'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:text-dark-100'
              }`}
            >
              {t('cards.patternMode')}
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm ${
                mode === 'custom'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:text-dark-100'
              }`}
            >
              {t('cards.customMode')}
            </button>
          </div>

          {mode === 'pattern' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">{t('cards.cardCount')}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={cardCount}
                  onChange={(e) => setCardCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {t('cards.namePattern')}
                  <span className="text-dark-500 ml-2 font-normal">{t('cards.namePatternHint')}</span>
                </label>
                <input
                  type="text"
                  value={namePattern}
                  onChange={(e) => setNamePattern(e.target.value)}
                  placeholder="Task {n}"
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">{t('cards.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('cards.optionalDescription')}
                  rows={2}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">{t('cards.tags')}</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag: Tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setSelectedTagIds(
                          selectedTagIds.includes(tag.id)
                            ? selectedTagIds.filter((id) => id !== tag.id)
                            : [...selectedTagIds, tag.id]
                        )
                      }}
                      className={`px-3 py-1 rounded-full text-xs ${
                        selectedTagIds.includes(tag.id)
                          ? 'ring-2 ring-primary-500'
                          : ''
                      }`}
                      style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">{t('cards.assignees')}</label>
                <div className="flex flex-wrap gap-2">
                  {spaceMembers.map((member) => (
                    <button
                      key={member.user_id}
                      onClick={() => {
                        setSelectedAssigneeIds(
                          selectedAssigneeIds.includes(member.user_id)
                            ? selectedAssigneeIds.filter((id) => id !== member.user_id)
                            : [...selectedAssigneeIds, member.user_id]
                        )
                      }}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                        selectedAssigneeIds.includes(member.user_id)
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-700 text-dark-300'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" style={{backgroundColor: getAvatarColor(member.username)}}>
                        {member.username[0].toUpperCase()}
                      </div>
                      {member.username}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-dark-700 rounded-lg p-3">
                <div className="text-xs text-dark-400 mb-2">{t('cards.preview')}</div>
                <div className="space-y-1">
                  {Array.from({ length: Math.min(cardCount, 5) }).map((_, i) => (
                    <div key={i} className="text-sm text-dark-200">
                      {namePattern.replace(/{n}/g, String(i + 1)).replace(/{N}/g, String(i + 1))}
                    </div>
                  ))}
                  {cardCount > 5 && <div className="text-xs text-dark-500">...{t('cards.andMore', { count: cardCount - 5 })}</div>}
                </div>
              </div>
            </div>
          )}

          {mode === 'custom' && (
            <div className="space-y-4">
              {customCards.length === 0 && (
                <div className="text-center py-8 text-dark-500">
                  {t('cards.noCustomCards')}
                </div>
              )}

              {customCards.map((card, index) => (
                <div key={index} className="bg-dark-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400">#{index + 1}</span>
                    <button
                      onClick={() => handleRemoveCustomCard(index)}
                      className="p-1 text-dark-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={card.name}
                    onChange={(e) => handleUpdateCustomCard(index, { name: e.target.value })}
                    placeholder={t('cards.cardName')}
                    className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded text-dark-100 text-sm"
                  />
                  <textarea
                    value={card.description}
                    onChange={(e) => handleUpdateCustomCard(index, { description: e.target.value })}
                    placeholder={t('cards.description')}
                    rows={2}
                    className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded text-dark-100 text-sm"
                  />
                </div>
              ))}

              <button
                onClick={handleAddCustomCard}
                className="w-full flex items-center justify-center gap-2 py-2 text-dark-400 hover:text-dark-100 border border-dark-600 border-dashed rounded-lg"
              >
                <Plus className="w-4 h-4" />
                {t('cards.addCard')}
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-dark-700 flex items-center justify-between">
          <div className="text-sm text-dark-400">
            {isGenerating && `${t('cards.generating')} ${generatedCount}/${mode === 'pattern' ? cardCount : customCards.length}`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-dark-300 hover:text-dark-100"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (mode === 'pattern' && !namePattern.trim()) || (mode === 'custom' && customCards.length === 0)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              {t('cards.generate')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
