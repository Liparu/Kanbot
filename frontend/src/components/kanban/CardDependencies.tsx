import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, X, Plus, Search, AlertCircle } from 'lucide-react'
import { cardsApi } from '@/api/boards'
import { useToast } from '@/components/common/Toast'

interface CardDependenciesProps {
  cardId: string
  spaceId: string
  blockedBy?: Array<{
    id: string
    card_id: string
    blocked_by_id: string
    blocked_by_card?: {
      id: string
      name: string
      column_id: string
    }
  }>
  blocking?: Array<{
    id: string
    card_id: string
    blocked_by_id: string
    card?: {
      id: string
      name: string
      column_id: string
    }
  }>
}

export default function CardDependencies({ 
  cardId, 
  spaceId, 
  blockedBy = [], 
  blocking = [] 
}: CardDependenciesProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Search for cards to add as dependencies
  const { data: searchResults } = useQuery({
    queryKey: ['cards', 'search', spaceId, searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return []
      const response = await cardsApi.search(spaceId, searchQuery)
      // Filter out the current card and already blocked cards
      const blockedIds = blockedBy.map(d => d.blocked_by_id)
      return response.data.filter(
        (c: { id: string }) => c.id !== cardId && !blockedIds.includes(c.id)
      )
    },
    enabled: searchQuery.length >= 2,
  })

  // Add dependency mutation
  const addDependencyMutation = useMutation({
    mutationFn: async (blockedById: string) => {
      await cardsApi.addDependency(cardId, blockedById)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      toast.success(t('cards.dependencyAdded') || 'Dependency added')
      setShowAddDropdown(false)
      setSearchQuery('')
    },
    onError: () => {
      toast.error(t('cards.dependencyError') || 'Failed to add dependency')
    },
  })

  // Remove dependency mutation
  const removeDependencyMutation = useMutation({
    mutationFn: async (blockedById: string) => {
      await cardsApi.removeDependency(cardId, blockedById)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', cardId] })
      toast.success(t('cards.dependencyRemoved') || 'Dependency removed')
    },
    onError: () => {
      toast.error(t('cards.dependencyError') || 'Failed to remove dependency')
    },
  })

  const hasBlockers = blockedBy.length > 0
  const isBlocking = blocking.length > 0

  return (
    <div>
      <h3 className="text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
        <Link2 className="w-4 h-4" />
        {t('cards.dependencies') || 'Dependencies'}
        {hasBlockers && (
          <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
            {blockedBy.length} {t('cards.blockers') || 'blockers'}
          </span>
        )}
      </h3>

      {/* Blocked By Section */}
      {hasBlockers && (
        <div className="mb-3">
          <div className="text-xs text-dark-400 mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-yellow-500" />
            {t('cards.blockedBy') || 'Blocked by'}:
          </div>
          <div className="space-y-1">
            {blockedBy.map((dep) => (
              <div
                key={dep.blocked_by_id}
                className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg group"
              >
                <span className="flex-1 text-sm text-dark-200 truncate">
                  {dep.blocked_by_card?.name || `Card ${dep.blocked_by_id.slice(0, 8)}...`}
                </span>
                <button
                  onClick={() => removeDependencyMutation.mutate(dep.blocked_by_id)}
                  className="p-1 text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                  title={t('cards.removeDependency') || 'Remove dependency'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocking Section */}
      {isBlocking && (
        <div className="mb-3">
          <div className="text-xs text-dark-400 mb-1">
            {t('cards.blocking') || 'Blocking'}:
          </div>
          <div className="space-y-1">
            {blocking.map((dep) => (
              <div
                key={dep.card_id}
                className="flex items-center gap-2 p-2 bg-dark-700 rounded-lg text-sm text-dark-300"
              >
                <span className="truncate">
                  {dep.card?.name || `Card ${dep.card_id.slice(0, 8)}...`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Dependency */}
      <div className="relative">
        <button
          onClick={() => setShowAddDropdown(!showAddDropdown)}
          className="flex items-center gap-2 text-sm text-dark-400 hover:text-primary-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('cards.addDependency') || 'Add blocker'}
        </button>

        {showAddDropdown && (
          <div className="absolute z-10 mt-1 w-64 bg-dark-800 border border-dark-600 rounded-lg shadow-lg">
            <div className="p-2 border-b border-dark-600">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('cards.searchCards') || 'Search cards...'}
                  className="w-full pl-8 pr-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-sm text-dark-100"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {searchQuery.length < 2 ? (
                <div className="p-2 text-sm text-dark-500 text-center">
                  {t('cards.typeToSearch') || 'Type to search...'}
                </div>
              ) : searchResults?.length === 0 ? (
                <div className="p-2 text-sm text-dark-500 text-center">
                  {t('cards.noResults') || 'No cards found'}
                </div>
              ) : (
                searchResults?.map((card: { id: string; name: string }) => (
                  <button
                    key={card.id}
                    onClick={() => addDependencyMutation.mutate(card.id)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-dark-700 rounded text-left text-sm text-dark-200"
                  >
                    <span className="truncate">{card.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
