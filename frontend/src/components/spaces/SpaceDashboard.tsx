import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, Users, Calendar, Tag, AlertTriangle, Inbox, Clock, ClipboardCheck, Archive } from 'lucide-react'
import { spacesApi } from '@/api/spaces'

export default function SpaceDashboard() {
  const { t } = useTranslation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()

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
            <h1 className="text-2xl font-bold text-dark-100">{space.name}</h1>
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
