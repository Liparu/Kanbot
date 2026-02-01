import { useQuery } from '@tanstack/react-query'
import { Users, Layers, CreditCard, MessageSquare, TrendingUp, Building2, Bot, User, RefreshCw } from 'lucide-react'
import { adminApi } from '@/api/admin'

export default function AdminStatsPanel() {
  const { data: stats, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminApi.getStats,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="text-center py-8 text-dark-400">Loading statistics...</div>
    )
  }

  if (error || !stats) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-2">Failed to load statistics</p>
        <p className="text-dark-500 text-sm mb-4">{(error as Error)?.message || 'Unknown error'}</p>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.total_users,
      subtitle: `+${stats.new_users_this_week} this week`,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Active Users',
      value: stats.active_users_7_days,
      subtitle: 'Last 7 days',
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Spaces',
      value: stats.total_spaces,
      subtitle: `${stats.personal_spaces} personal, ${stats.team_spaces} company`,
      icon: Layers,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Total Cards',
      value: stats.total_cards,
      subtitle: `${stats.completed_cards} tasks completed`,
      icon: CreditCard,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Comments',
      value: stats.total_comments,
      subtitle: 'Total comments',
      icon: MessageSquare,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
    },
    {
      title: 'Agent Spaces',
      value: stats.agent_spaces,
      subtitle: 'AI-powered spaces',
      icon: Bot,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-dark-700 rounded-xl p-4 border border-dark-600"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-dark-400">{card.title}</p>
                <p className="text-2xl font-bold text-dark-100 mt-1">{card.value.toLocaleString()}</p>
                <p className="text-xs text-dark-500 mt-1">{card.subtitle}</p>
              </div>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
          <h3 className="text-sm font-medium text-dark-300 mb-3">Space Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-dark-200">Personal</span>
              </div>
              <span className="text-sm text-dark-100">{stats.personal_spaces}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-dark-200">Company</span>
              </div>
              <span className="text-sm text-dark-100">{stats.team_spaces}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-dark-200">Agent</span>
              </div>
              <span className="text-sm text-dark-100">{stats.agent_spaces}</span>
            </div>
          </div>
        </div>

        <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
          <h3 className="text-sm font-medium text-dark-300 mb-3">User Growth</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark-400">This week</span>
              <span className="text-sm text-green-400">+{stats.new_users_this_week}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark-400">This month</span>
              <span className="text-sm text-green-400">+{stats.new_users_this_month}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark-400">Card completion rate</span>
              <span className="text-sm text-dark-100">
                {stats.total_cards > 0
                  ? Math.round((stats.completed_cards / stats.total_cards) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
