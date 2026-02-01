import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Building2, User, Trash2, LayoutGrid, AlertTriangle, Inbox, Clock, ClipboardCheck, Bot } from 'lucide-react'
import { spacesApi } from '@/api/spaces'
import { useSpaceStore } from '@/stores/spaces'
import { useConfirm } from '@/components/common/ConfirmDialog'
import type { Space } from '@/types'

export default function SpacesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceType, setNewSpaceType] = useState<'personal' | 'company' | 'agent'>('personal')
  const [error, setError] = useState<string | null>(null)
  const { removeSpace, addSpace, setCurrentSpace } = useSpaceStore()

  const { data: spaces = [], isLoading } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: 'personal' | 'company' | 'agent' }) =>
      spacesApi.create(data),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] })
      addSpace(space)
      setShowCreateModal(false)
      setNewSpaceName('')
      setError(null)
      setCurrentSpace(space.id)
      navigate(`/spaces/${space.id}`)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create space')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: spacesApi.delete,
    onSuccess: (_, spaceId) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] })
      removeSpace(spaceId)
      setError(null)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to delete space')
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (newSpaceName.trim()) {
      createMutation.mutate({ name: newSpaceName, type: newSpaceType })
    }
  }

  const handleSpaceClick = (space: Space) => {
    setCurrentSpace(space.id)
    navigate(`/spaces/${space.id}`)
  }

  const handleDeleteSpace = async (e: React.MouseEvent, spaceId: string) => {
    e.stopPropagation()
    const confirmed = await confirm({
      title: t('common.deleteConfirmTitle'),
      message: t('spaces.deleteConfirm'),
      confirmText: t('common.delete'),
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate(spaceId)
    }
  }

  const personalSpaces = spaces.filter((s: Space) => s.type === 'personal')
  const companySpaces = spaces.filter((s: Space) => s.type === 'company')
  const agentSpaces = spaces.filter((s: Space) => s.type === 'agent')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">{t('spaces.title')}</h1>
          <p className="text-dark-400 mt-1">{t('stats.title')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('spaces.createSpace')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {personalSpaces.length > 0 && (
        <div className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-medium text-dark-200 mb-4">
            <User className="w-5 h-5" />
            {t('spaces.personal')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalSpaces.map((space: Space) => (
              <SpaceCard
                key={space.id}
                space={space}
                onClick={() => handleSpaceClick(space)}
                onDelete={(e) => handleDeleteSpace(e, space.id)}
              />
            ))}
          </div>
        </div>
      )}

      {companySpaces.length > 0 && (
        <div className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-medium text-dark-200 mb-4">
            <Building2 className="w-5 h-5" />
            {t('spaces.company')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companySpaces.map((space: Space) => (
              <SpaceCard
                key={space.id}
                space={space}
                onClick={() => handleSpaceClick(space)}
                onDelete={(e) => handleDeleteSpace(e, space.id)}
              />
            ))}
          </div>
        </div>
      )}

      {agentSpaces.length > 0 && (
        <div className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-medium text-dark-200 mb-4">
            <Bot className="w-5 h-5" />
            {t('spaces.agent')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentSpaces.map((space: Space) => (
              <SpaceCard
                key={space.id}
                space={space}
                onClick={() => handleSpaceClick(space)}
                onDelete={(e) => handleDeleteSpace(e, space.id)}
              />
            ))}
          </div>
        </div>
      )}

      {spaces.length === 0 && (
        <div className="text-center py-12">
          <p className="text-dark-400 mb-4">No spaces yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            {t('spaces.createSpace')}
          </button>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700"
          >
            <h2 className="text-xl font-bold text-dark-100 mb-4">
              {t('spaces.createSpace')}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  {t('spaces.spaceName')}
                </label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:border-primary-500"
                  placeholder="My Space"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  {t('spaces.spaceType')}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="spaceType"
                      checked={newSpaceType === 'personal'}
                      onChange={() => setNewSpaceType('personal')}
                      className="text-primary-600"
                    />
                    <span className="text-dark-200">{t('spaces.personal')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="spaceType"
                      checked={newSpaceType === 'company'}
                      onChange={() => setNewSpaceType('company')}
                      className="text-primary-600"
                    />
                    <span className="text-dark-200">{t('spaces.company')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="spaceType"
                      checked={newSpaceType === 'agent'}
                      onChange={() => setNewSpaceType('agent')}
                      className="text-primary-600"
                    />
                    <span className="text-dark-200">{t('spaces.agent')}</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-dark-300 hover:text-dark-100 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {t('common.create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function SpaceCard({ space, onClick, onDelete }: { space: Space; onClick: () => void; onDelete: (e: React.MouseEvent) => void }) {
  const { t } = useTranslation()

  const { data: stats } = useQuery({
    queryKey: ['space-stats', space.id],
    queryFn: () => spacesApi.stats(space.id),
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-dark-800 rounded-xl p-4 border border-dark-700 hover:border-primary-500 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-dark-100">{space.name}</h3>
          <p className="text-sm text-dark-400 mt-1">
            {space.members?.length || 0} {t('spaces.members').toLowerCase()}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="p-2 text-dark-500 hover:text-red-400 rounded-lg hover:bg-dark-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      {stats && (
        <div className="grid grid-cols-5 gap-2 pt-3 border-t border-dark-700">
          <div className="text-center">
            <LayoutGrid className="w-4 h-4 mx-auto text-dark-400 mb-1" />
            <span className="text-sm font-medium text-dark-200">{stats.total_cards}</span>
          </div>
          <div className="text-center">
            <Inbox className="w-4 h-4 mx-auto text-blue-400 mb-1" />
            <span className="text-sm font-medium text-dark-200">{stats.inbox_cards}</span>
          </div>
          <div className="text-center">
            <Clock className="w-4 h-4 mx-auto text-yellow-400 mb-1" />
            <span className="text-sm font-medium text-dark-200">{stats.waiting_cards}</span>
          </div>
          <div className="text-center">
            <ClipboardCheck className="w-4 h-4 mx-auto text-purple-400 mb-1" />
            <span className="text-sm font-medium text-dark-200">{stats.review_cards}</span>
          </div>
          <div className="text-center">
            <AlertTriangle className="w-4 h-4 mx-auto text-red-400 mb-1" />
            <span className="text-sm font-medium text-dark-200">{stats.urgent_cards}</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
