import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, Users, Calendar, Tag, AlertTriangle, Inbox, Clock, ClipboardCheck, Archive, Edit2, Check, X } from 'lucide-react'
import { spacesApi } from '@/api/spaces'
import ScheduleTimeline from './ScheduleTimeline'
import SubAgentWidget from './SubAgentWidget'
import AddAgentModal from './AddAgentModal'

export default function SpaceDashboard() {
  const { t } = useTranslation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false)

  const { data: space, isLoading: spaceLoading } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  })

  const { data: stats } = useQuery({
    queryKey: ['space-stats', spaceId],
    queryFn: () => spacesApi.stats(spaceId!),
    enabled: !!spaceId,
  })

  const updateSpaceMutation = useMutation({
    mutationFn: (data: { name: string }) => spacesApi.update(spaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] })
      queryClient.invalidateQueries({ queryKey: ['spaces'] })
      setIsEditingName(false)
      setEditedName('')
    },
  })

  const handleStartEdit = () => {
    if (space) {
      setEditedName(space.name)
      setIsEditingName(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  const handleSaveName = () => {
    if (editedName.trim() && editedName.trim() !== space?.name) {
      updateSpaceMutation.mutate({ name: editedName.trim() })
    } else {
      setIsEditingName(false)
    }
  }

  if (spaceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('common.loading')}</div>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('common.error')}</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') handleCancelEdit()
                  }}
                  className="text-2xl font-bold bg-dark-700 border border-dark-600 rounded-lg px-3 py-1 text-dark-100 focus:outline-none focus:border-primary-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={updateSpaceMutation.isPending || !editedName.trim()}
                  className="p-2 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 text-white rounded-lg transition-colors"
                  title={t('common.save')}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg transition-colors"
                  title={t('common.cancel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold text-dark-100">{space.name}</h1>
                <button
                  onClick={handleStartEdit}
                  className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title={t('common.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-dark-400 mt-1">
              {space.type === 'personal' ? t('spaces.personal') : space.type === 'agent' ? t('spaces.agent') : t('spaces.company')} · {space.members?.length || 0}{' '}
              {t('spaces.members').toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={LayoutGrid} label={t('stats.total')} value={stats?.total_cards || 0} />
        <StatCard icon={Inbox} label={t('stats.inbox')} value={stats?.inbox_cards || 0} />
        <StatCard icon={Clock} label={t('stats.waiting')} value={stats?.waiting_cards || 0} />
        <StatCard icon={AlertTriangle} label={t('stats.urgent')} value={stats?.urgent_cards || 0} />
        <StatCard icon={Clock} label={t('stats.inProgress')} value={stats?.in_progress_cards || 0} />
        <StatCard icon={ClipboardCheck} label={t('stats.review')} value={stats?.review_cards || 0} />
        <StatCard icon={Archive} label={t('stats.archive')} value={stats?.archive_cards || 0} />
      </div>

      {/* Agent Dashboard Widgets - shown for agent spaces */}
      {space?.name?.toLowerCase().includes('qratos') && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ScheduleTimeline />
          <SubAgentWidget 
            spaceId={spaceId!}
            onAddAgent={() => setIsAddAgentModalOpen(true)}
          />
        </div>
      )}

      {/* Add Agent Modal */}
      <AddAgentModal
        spaceId={spaceId!}
        isOpen={isAddAgentModalOpen}
        onClose={() => setIsAddAgentModalOpen(false)}
      />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <button
          onClick={() => navigate(`/spaces/${spaceId}/kanban`)}
          className="px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm"
        >
          {t('kanban.title') || 'Kanban'}
        </button>
        <button className="px-3 py-2 bg-dark-800 border border-dark-700 text-dark-300 rounded-lg text-sm">
          <Users className="w-4 h-4 inline mr-1" />
          {t('spaces.members')}
        </button>
        <Link
          to={`/calendar?space=${spaceId}`}
          className="px-3 py-2 bg-dark-800 border border-dark-700 text-dark-300 rounded-lg text-sm"
        >
          <Calendar className="w-4 h-4 inline mr-1" />
          {t('calendar.title')}
        </Link>
        <button className="px-3 py-2 bg-dark-800 border border-dark-700 text-dark-300 rounded-lg text-sm">
          <Tag className="w-4 h-4 inline mr-1" />
          {t('tags.title')}
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 bg-dark-700 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-dark-300" />
      </div>
      <div>
        <div className="text-sm text-dark-400">{label}</div>
        <div className="text-lg font-semibold text-dark-100">{value}</div>
      </div>
    </div>
  )
}
