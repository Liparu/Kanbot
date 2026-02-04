import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  LayoutGrid,
  ArrowLeft,
  Plus,
  X,
  Layers,
  Eye,
  EyeOff,
  Loader2,
  ChevronDown,
  Building2,
  Bot,
  User,
  Check,
} from 'lucide-react'
import { format, startOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, parseISO, addHours, isSameMonth, isToday, isSameDay } from 'date-fns'
import { dateToLocalISOString, parseISOLocal } from '@/utils/dateFormat'
import { columnsApi, cardsApi, tagsApi } from '@/api/boards'
import { spacesApi } from '@/api/spaces'
import { useToast } from '@/components/common/Toast'
import DateTimePicker from '@/components/common/DateTimePicker'
import MonthView from './MonthView'
import WeekView from './WeekView'
import CardDetailModal from '@/components/kanban/CardDetailModal'
import type { CalendarDisplayEvent } from '@/utils/calendar'
import { getAvatarColor } from '@/utils/avatarColor'
import type { Card, Column, Space } from '@/types'

type ViewMode = 'month' | 'week'
type SpaceType = 'personal' | 'company' | 'agent'

interface SpaceOverlay {
  id: string
  name: string
  color: string
  visible: boolean
  type: SpaceType
}

interface SpaceBoardData {
  spaceId: string
  boards: Array<{ id: string; columns: Array<Column & { cards?: Card[] }> }>
}

const SPACE_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#6366f1',
]

const SPACE_TYPE_DEFAULT_COLORS: Record<SpaceType, string> = {
  personal: '#3b82f6',
  company: '#8b5cf6',
  agent: '#06b6d4',
}

const getSpaceColor = (space: Space, index: number): string => {
  if (space.color) {
    return space.color
  }
  const spaceType = (space.type || 'personal') as SpaceType
  return SPACE_TYPE_DEFAULT_COLORS[spaceType] || SPACE_COLORS[index % SPACE_COLORS.length]
}

const SPACE_TYPE_ICONS: Record<SpaceType, React.ReactNode> = {
  personal: <User className="w-4 h-4" />,
  company: <Building2 className="w-4 h-4" />,
  agent: <Bot className="w-4 h-4" />,
}

const isArchiveColumn = (column: Column): boolean => {
  return column.category === 'archive'
}

const isLightColor = (color: string): boolean => {
  if (!color) return false
  const hex = color.replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

export default function CalendarPage() {
  const { t } = useTranslation()
  const { spaceId: urlSpaceId } = useParams<{ spaceId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  
  // Support both URL param (/spaces/:spaceId/calendar) and query param (/calendar?space=xxx)
  const spaceId = urlSpaceId || searchParams.get('space') || undefined
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(searchParams.get('card'))
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null)
  const [showOverlaySelector, setShowOverlaySelector] = useState(false)
  const [spaceOverlays, setSpaceOverlays] = useState<SpaceOverlay[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Record<SpaceType, boolean>>({
    personal: true,
    company: true,
    agent: true,
  })
  const overlayRef = useRef<HTMLDivElement>(null)
  const isGlobalView = !spaceId

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      // Escape - close modals
      if (e.key === 'Escape') {
        if (selectedCardId) {
          handleCardModalClose()
        } else if (showCreateModal) {
          setShowCreateModal(false)
          setCreateModalDate(null)
        } else if (showOverlaySelector) {
          setShowOverlaySelector(false)
        }
        return
      }
      
      // c - create new card
      if (e.key === 'c' && !showCreateModal && !selectedCardId) {
        e.preventDefault()
        openCreateModal()
        return
      }
      
      // t - go to today
      if (e.key === 't' && !showCreateModal && !selectedCardId) {
        e.preventDefault()
        goToToday()
        return
      }
      
      // Arrow keys - navigation
      if (!showCreateModal && !selectedCardId) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          navigatePrev()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          navigateNext()
        }
      }
      
      // m/w - switch view mode
      if (e.key === 'm' && !showCreateModal && !selectedCardId) {
        e.preventDefault()
        setViewMode('month')
      } else if (e.key === 'w' && !showCreateModal && !selectedCardId) {
        e.preventDefault()
        setViewMode('week')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCardId, showCreateModal, showOverlaySelector, viewMode])

  // Dragging state - removed complex handlers, using native scroll

  // Fetch all spaces for global view
  const { data: allSpaces, isLoading: spacesLoading } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
    enabled: isGlobalView,
  })

  const { data: singleSpace } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  })

  // Initialize space overlays when allSpaces changes
  useEffect(() => {
    if (isGlobalView && allSpaces && allSpaces.length > 0 && spaceOverlays.length === 0) {
      const overlays = allSpaces.map((space, index) => ({
        id: space.id,
        name: space.name,
        color: getSpaceColor(space, index),
        visible: true,
        type: (space.type || 'personal') as SpaceType,
      }))
      setSpaceOverlays(overlays)
    }
  }, [isGlobalView, allSpaces, spaceOverlays.length])

  // Get visible space IDs
  const visibleSpaceIds = useMemo(() => {
    return spaceOverlays.filter(s => s.visible).map(s => s.id)
  }, [spaceOverlays])

  // Fetch columns and cards for all visible spaces in global view
  const { data: allSpaceBoards, isLoading: boardsLoading } = useQuery({
    queryKey: ['allSpaceBoards', visibleSpaceIds.sort().join(',')],
    queryFn: async () => {
      if (visibleSpaceIds.length === 0) return []
      
      const results = await Promise.all(
        visibleSpaceIds.map(async (sid) => {
          try {
            const cols = await columnsApi.list(sid)
            if (cols.length > 0) {
              const colsWithCards = await Promise.all(
                cols.map(async (col) => {
                  const colCards = await cardsApi.list({ column_id: col.id })
                  return { ...col, cards: colCards }
                })
              )
              return {
                spaceId: sid,
                boards: [{ id: sid, columns: colsWithCards }]
              } as SpaceBoardData
            }
            return null
          } catch {
            return null
          }
        })
      )
      return results.filter((r): r is SpaceBoardData => r !== null)
    },
    enabled: isGlobalView && visibleSpaceIds.length > 0,
    staleTime: 30000,
  })

  // Fetch columns and cards for single space view
  const { data: spaceColumns } = useQuery({
    queryKey: ['columns', spaceId],
    queryFn: () => columnsApi.list(spaceId!),
    enabled: !!spaceId && !isGlobalView,
  })

  const { data: board, isLoading: singleBoardLoading } = useQuery({
    queryKey: ['spaceBoard', spaceId, spaceColumns?.length],
    queryFn: async () => {
      if (!spaceColumns || spaceColumns.length === 0) return null
      const colsWithCards = await Promise.all(
        spaceColumns.map(async (col) => {
          const colCards = await cardsApi.list({ column_id: col.id })
          return { ...col, cards: colCards }
        })
      )
      return { id: spaceId!, columns: colsWithCards }
    },
    enabled: !!spaceColumns && spaceColumns.length > 0,
  })

  // Click away to close overlay selector
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setShowOverlaySelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Process events (cards) for calendar display - ALL CARDS ARE EVENTS
  const events = useMemo(() => {
    const allEvents: Array<{
      id: string
      title: string
      start: Date
      end: Date
      color: string
      card: Card
      isAllDay: boolean
      description?: string
      location?: string
      spaceId?: string
      spaceName?: string
      columnName?: string
      columnId?: string
      taskCount?: number
      completedTaskCount?: number
      assigneeCount?: number
      tagNames?: string[]
    }> = []
    
    if (isGlobalView && allSpaceBoards) {
      // Global view - collect cards from all visible spaces
      allSpaceBoards.forEach(({ spaceId: sid, boards: spaceBoards }) => {
        const overlay = spaceOverlays.find(s => s.id === sid)
        if (!overlay?.visible) return
        
        spaceBoards.forEach((board) => {
          board.columns?.forEach((column) => {
            if (isArchiveColumn(column)) return
            column.cards?.forEach((card) => {
              if (card.start_date || card.end_date) {
                const start = card.start_date ? parseISOLocal(card.start_date) : parseISOLocal(card.end_date!)
                const end = card.end_date ? parseISOLocal(card.end_date) : start
                const tagColor = card.tags?.[0]?.tag?.color || overlay.color || '#3b82f6'
                // Check if time was explicitly set by looking for 'T' in the ISO string
                // (date-only strings like "2026-02-04" don't have 'T', datetime strings like "2026-02-04T14:30:00" do)
                const hasTime = card.start_date?.includes('T')
                allEvents.push({
                  id: card.id,
                  title: card.name,
                  start,
                  end,
                  color: tagColor,
                  card,
                  isAllDay: !hasTime,
                  description: card.description,
                  location: card.location,
                  spaceId: sid,
                  spaceName: overlay.name,
                  columnName: column.name,
                  columnId: column.id,
                  taskCount: card.tasks?.length || 0,
                  completedTaskCount: card.tasks?.filter(t => t.completed).length || 0,
                  assigneeCount: card.assignees?.length || 0,
                  tagNames: card.tags?.map(t => t.tag.name) || [],
                })
              }
            })
          })
        })
      })
    } else if (!isGlobalView && board?.columns) {
      // Single space view
      board.columns.forEach((column) => {
        if (isArchiveColumn(column)) return
        column.cards?.forEach((card) => {
          if (card.start_date || card.end_date) {
            const start = card.start_date ? parseISOLocal(card.start_date) : parseISOLocal(card.end_date!)
            const end = card.end_date ? parseISOLocal(card.end_date) : start
            const tagColor = card.tags?.[0]?.tag?.color || '#3b82f6'
            // Check if time was explicitly set by looking for 'T' in the ISO string
            // (date-only strings like "2026-02-04" don't have 'T', datetime strings like "2026-02-04T14:30:00" do)
            const hasTime = card.start_date?.includes('T')
            allEvents.push({
              id: card.id,
              title: card.name,
              start,
              end,
              color: tagColor,
              card,
              isAllDay: !hasTime,
              description: card.description,
              location: card.location,
              spaceId,
              spaceName: singleSpace?.name,
              columnName: column.name,
              columnId: column.id,
              taskCount: card.tasks?.length || 0,
              completedTaskCount: card.tasks?.filter(t => t.completed).length || 0,
              assigneeCount: card.assignees?.length || 0,
              tagNames: card.tags?.map(t => t.tag.name) || [],
            })
          }
        })
      })
    }

    return allEvents
  }, [board, allSpaceBoards, isGlobalView, spaceOverlays, singleSpace, spaceId])

  // Calculate event stats
  const eventStats = useMemo(() => {
    const today = new Date()
    const todayEvents = events.filter(e => isSameDay(e.start, today) || (e.start <= today && e.end >= today))
    const thisMonthEvents = events.filter(e => isSameMonth(e.start, currentDate))
    
    return {
      total: events.length,
      today: todayEvents.length,
      thisMonth: thisMonthEvents.length,
    }
  }, [events, currentDate])

  // Navigation functions (defined before drag handlers that use them)
  const navigatePrev = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(d => subMonths(d, 1))
    } else {
      setCurrentDate(d => subWeeks(d, 1))
    }
  }, [viewMode])

  const navigateNext = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(d => addMonths(d, 1))
    } else {
      setCurrentDate(d => addWeeks(d, 1))
    }
  }, [viewMode])

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const openCreateModal = (date?: Date, hour?: number) => {
    const baseDate = date || new Date()
    if (hour !== undefined) {
      baseDate.setHours(hour, 0, 0, 0)
    }
    setCreateModalDate(baseDate)
    setShowCreateModal(true)
  }

  const toggleSpaceVisibility = (id: string) => {
    setSpaceOverlays((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    )
  }

  const toggleCategoryVisibility = (type: SpaceType, visible: boolean) => {
    setSpaceOverlays((prev) =>
      prev.map((s) => (s.type === type ? { ...s, visible } : s))
    )
  }

  const handleEventClick = (event: CalendarDisplayEvent) => {
    if (event.card && event.card.id) {
      setSelectedCardId(event.card.id)
      if (event.spaceId) {
        setSearchParams({ card: event.card.id })
      }
    }
  }

  const handleCardModalClose = () => {
    setSelectedCardId(null)
    setSearchParams({})
    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['columns'] })
    queryClient.invalidateQueries({ queryKey: ['allSpaceBoards'] })
  }

  const handleCardCreated = () => {
    setShowCreateModal(false)
    setCreateModalDate(null)
    queryClient.invalidateQueries({ queryKey: ['columns'] })
    queryClient.invalidateQueries({ queryKey: ['allSpaceBoards'] })
    toast.success(t('cards.created'))
  }

  // Group spaces by type
  const spacesByType = useMemo(() => {
    const grouped: Record<SpaceType, SpaceOverlay[]> = {
      personal: [],
      company: [],
      agent: [],
    }
    spaceOverlays.forEach(space => {
      const type = space.type || 'personal'
      if (grouped[type]) {
        grouped[type].push(space)
      }
    })
    return grouped
  }, [spaceOverlays])

  const isLoading = isGlobalView ? (spacesLoading || boardsLoading) : singleBoardLoading

  // Find the card info for the detail modal
  const selectedCardInfo = useMemo(() => {
    if (!selectedCardId) return null
    const event = events.find(e => e.card?.id === selectedCardId)
    if (!event?.card) return null
    return {
      cardId: event.card.id,
      columnId: event.columnId || '',
      spaceId: event.spaceId || spaceId || '',
    }
  }, [selectedCardId, events, spaceId])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col bg-dark-900"
    >
      {/* Header */}
      <div className="relative flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-4">
          {spaceId && (
            <Link
              to={`/spaces/${spaceId}`}
              className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <LayoutGrid className="w-4 h-4" />
              {t('calendar.backToKanban')}
            </Link>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl font-semibold text-white">
              {singleSpace?.name ? `${singleSpace.name} - ${t('calendar.title')}` : t('calendar.title')}
            </h1>
          </div>
          
          {/* Event stats badge */}
          {!isLoading && events.length > 0 && (
            <div className="hidden md:flex items-center gap-3 ml-4 text-xs text-dark-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary-500" />
                {eventStats.today} {t('calendar.today').toLowerCase()}
              </span>
              <span>·</span>
              <span>{eventStats.thisMonth} {t('calendar.thisMonth')}</span>
            </div>
          )}
        </div>

        {/* Center - Prominent Month Display */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:block">
          <h2 className="text-2xl font-bold text-white tracking-wide">
            {viewMode === 'month' 
              ? format(currentDate, 'MMMM yyyy')
              : format(currentDate, 'MMMM yyyy')
            }
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Overlay selector for global view */}
          {isGlobalView && (
            <div className="relative" ref={overlayRef}>
              <button
                onClick={() => setShowOverlaySelector(!showOverlaySelector)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  spaceOverlays.filter(s => s.visible).length > 0 
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30' 
                    : 'bg-dark-700 hover:bg-dark-600'
                }`}
              >
                <Layers className="w-4 h-4" />
                {t('calendar.overlays')}
                <span className="bg-primary-600 text-white text-xs px-1.5 rounded-full min-w-[20px] text-center">
                  {spaceOverlays.filter((s) => s.visible).length}/{spaceOverlays.length}
                </span>
              </button>
              
              <AnimatePresence>
                {showOverlaySelector && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 min-w-[280px] max-h-[400px] overflow-hidden"
                  >
                    <div className="p-3 border-b border-dark-700">
                      <span className="text-sm font-medium text-white">{t('calendar.selectSpaces')}</span>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto">
                      {/* Personal spaces */}
                      {spacesByType.personal.length > 0 && (
                        <SpaceCategorySection
                          type="personal"
                          icon={SPACE_TYPE_ICONS.personal}
                          label={t('spaces.personal')}
                          spaces={spacesByType.personal}
                          expanded={expandedCategories.personal}
                          onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, personal: !prev.personal }))}
                          onToggleSpace={toggleSpaceVisibility}
                          onToggleAll={(visible) => toggleCategoryVisibility('personal', visible)}
                        />
                      )}
                      
                      {/* Company spaces */}
                      {spacesByType.company.length > 0 && (
                        <SpaceCategorySection
                          type="company"
                          icon={SPACE_TYPE_ICONS.company}
                          label={t('spaces.company')}
                          spaces={spacesByType.company}
                          expanded={expandedCategories.company}
                          onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, company: !prev.company }))}
                          onToggleSpace={toggleSpaceVisibility}
                          onToggleAll={(visible) => toggleCategoryVisibility('company', visible)}
                        />
                      )}
                      
                      {/* Agent spaces */}
                      {spacesByType.agent.length > 0 && (
                        <SpaceCategorySection
                          type="agent"
                          icon={SPACE_TYPE_ICONS.agent}
                          label={t('spaces.agent')}
                          spaces={spacesByType.agent}
                          expanded={expandedCategories.agent}
                          onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, agent: !prev.agent }))}
                          onToggleSpace={toggleSpaceVisibility}
                          onToggleAll={(visible) => toggleCategoryVisibility('agent', visible)}
                        />
                      )}
                      
                      {spaceOverlays.length === 0 && (
                        <div className="text-center py-4 text-dark-400 text-sm">
                          {t('calendar.noSpaces')}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-2 border-t border-dark-700 flex gap-2">
                      <button
                        onClick={() => setSpaceOverlays(prev => prev.map(s => ({ ...s, visible: true })))}
                        className="flex-1 text-xs py-1.5 text-primary-400 hover:bg-dark-700 rounded transition-colors"
                      >
                        {t('calendar.showAll')}
                      </button>
                      <button
                        onClick={() => setSpaceOverlays(prev => prev.map(s => ({ ...s, visible: false })))}
                        className="flex-1 text-xs py-1.5 text-dark-400 hover:bg-dark-700 rounded transition-colors"
                      >
                        {t('calendar.hideAll')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          {/* Create card button */}
          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('cards.createCard')}</span>
          </button>
          
          {/* Today button */}
          <button
            onClick={goToToday}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isToday(currentDate) 
                ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30' 
                : 'bg-dark-700 hover:bg-dark-600'
            }`}
          >
            {t('calendar.today')}
          </button>
          
          {/* Navigation */}
          <div className="flex items-center bg-dark-800 rounded-lg border border-dark-700">
            <button
              onClick={navigatePrev}
              className="p-2 hover:bg-dark-700 rounded-l-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 text-sm font-medium min-w-[150px] text-center">
              {viewMode === 'month' 
                ? format(currentDate, 'MMMM yyyy')
                : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), 'MMM d, yyyy')}`
              }
            </span>
            <button
              onClick={navigateNext}
              className="p-2 hover:bg-dark-700 rounded-r-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          {/* View mode switcher */}
          <div className="flex bg-dark-800 rounded-lg border border-dark-700">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-sm rounded-l-lg transition-colors ${
                viewMode === 'month' ? 'bg-primary-600 text-white' : 'hover:bg-dark-700'
              }`}
            >
              {t('calendar.month')}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm rounded-r-lg transition-colors ${
                viewMode === 'week' ? 'bg-primary-600 text-white' : 'hover:bg-dark-700'
              }`}
            >
              {t('calendar.week')}
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
            <p className="text-dark-400">{t('common.loading')}</p>
          </div>
        </div>
      )}

      {/* Empty State for Global View */}
      {!isLoading && isGlobalView && visibleSpaceIds.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-dark-800 flex items-center justify-center">
              <Layers className="w-10 h-10 text-dark-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{t('calendar.noSpacesSelected')}</h3>
            <p className="text-dark-400 mb-4">{t('calendar.selectSpacesHint')}</p>
            <button
              onClick={() => setShowOverlaySelector(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
            >
              {t('calendar.selectSpaces')}
            </button>
          </div>
        </div>
      )}

      {/* Empty state when no events have dates */}
      {!isLoading && (isGlobalView ? visibleSpaceIds.length > 0 : true) && events.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-900/50 to-dark-800 flex items-center justify-center">
              <Calendar className="w-10 h-10 text-primary-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{t('calendar.noEvents')}</h3>
            <p className="text-dark-400 mb-4">{t('calendar.noEventsHint')}</p>
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('cards.createCard')}
            </button>
            <p className="mt-4 text-xs text-dark-500">
              {t('calendar.keyboardHint')}
            </p>
          </div>
        </div>
      )}

      {/* Calendar Views - with smooth transitions and swipe navigation */}
      {!isLoading && (isGlobalView ? visibleSpaceIds.length > 0 : true) && events.length > 0 && (
        <motion.div 
          className="flex-1 overflow-auto scroll-smooth"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            const threshold = 50
            if (info.offset.x > threshold) {
              navigatePrev()
            } else if (info.offset.x < -threshold) {
              navigateNext()
            }
          }}
          style={{ cursor: 'grab' }}
          whileDrag={{ cursor: 'grabbing' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, x: viewMode === 'week' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: viewMode === 'week' ? -20 : 20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="h-full pointer-events-auto"
            >
              {viewMode === 'month' ? (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                  onDayClick={(day) => openCreateModal(day)}
                  onCreateEvent={openCreateModal}
                  isGlobalView={isGlobalView}
                />
              ) : (
                <WeekView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                  onDayClick={(day) => openCreateModal(day)}
                  onCreateEvent={openCreateModal}
                  isGlobalView={isGlobalView}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* Card Detail Modal */}
      <AnimatePresence>
        {selectedCardInfo && (
          <CardDetailModal
            cardId={selectedCardInfo.cardId}
            columnId={selectedCardInfo.columnId}
            spaceId={selectedCardInfo.spaceId}
            onClose={handleCardModalClose}
          />
        )}
      </AnimatePresence>

      {/* Card Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CardCreationModal
            initialDate={createModalDate}
            spaceId={spaceId}
            isGlobalView={isGlobalView}
            allSpaces={allSpaces}
            onClose={() => {
              setShowCreateModal(false)
              setCreateModalDate(null)
            }}
            onCreated={handleCardCreated}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Space Category Section Component
interface SpaceCategorySectionProps {
  type: SpaceType
  icon: React.ReactNode
  label: string
  spaces: SpaceOverlay[]
  expanded: boolean
  onToggleExpand: () => void
  onToggleSpace: (id: string) => void
  onToggleAll: (visible: boolean) => void
}

function SpaceCategorySection({
  type: _type,
  icon,
  label,
  spaces,
  expanded,
  onToggleExpand,
  onToggleSpace,
  onToggleAll,
}: SpaceCategorySectionProps) {
  const visibleCount = spaces.filter(s => s.visible).length

  return (
    <div className="border-b border-dark-700 last:border-b-0">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-dark-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? '' : '-rotate-90'}`} />
          {icon}
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-400">{visibleCount}/{spaces.length}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleAll(visibleCount < spaces.length)
            }}
            className="text-xs text-primary-400 hover:text-primary-300 px-1"
          >
            {visibleCount === spaces.length ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => onToggleSpace(space.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 pl-9 transition-colors ${
                  space.visible ? 'bg-dark-700/30' : 'hover:bg-dark-700/20'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    space.visible ? 'border-transparent' : 'border-dark-500'
                  }`}
                  style={{ backgroundColor: space.visible ? space.color : 'transparent' }}
                >
                  {space.visible && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`flex-1 text-left text-sm truncate ${space.visible ? 'text-white' : 'text-dark-400'}`}>
                  {space.name}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Card Creation Modal Component - Like Card Detail Modal
interface CardCreationModalProps {
  initialDate: Date | null
  spaceId?: string
  isGlobalView: boolean
  allSpaces?: Array<{ id: string; name: string; type?: string }>
  onClose: () => void
  onCreated: () => void
}

function CardCreationModal({
  initialDate,
  spaceId,
  isGlobalView,
  allSpaces,
  onClose,
  onCreated,
}: CardCreationModalProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  
  // Basic form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const locationRef = useRef<HTMLDivElement>(null)
  const skipLocationFetch = useRef(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaceId || '')
  const [selectedColumnId, setSelectedColumnId] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [tasks, setTasks] = useState<Array<{ text: string; completed: boolean }>>([])
  const [newTask, setNewTask] = useState('')
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
  const assigneeDropdownRef = useRef<HTMLDivElement>(null)

  // Set selectedSpaceId when spaceId or allSpaces becomes available
  useEffect(() => {
    if (!selectedSpaceId) {
      if (spaceId) {
        setSelectedSpaceId(spaceId)
      } else if (allSpaces && allSpaces.length > 0) {
        setSelectedSpaceId(allSpaces[0].id)
      }
    }
  }, [spaceId, allSpaces, selectedSpaceId])

  // Initialize dates safely - use local ISO format to avoid timezone shifts
  useEffect(() => {
    if (initialDate && initialDate instanceof Date && !isNaN(initialDate.getTime())) {
      setStartDate(dateToLocalISOString(initialDate))
      setEndDate(dateToLocalISOString(addHours(initialDate, 1)))
    }
  }, [])

  // Location autocomplete with OpenStreetMap Nominatim
  useEffect(() => {
    if (skipLocationFetch.current) {
      skipLocationFetch.current = false
      return
    }
    
    if (location.trim().length < 3) {
      setLocationSuggestions([])
      setShowLocationSuggestions(false)
      return
    }

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(location)}`,
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

    return () => window.clearTimeout(timeout)
  }, [location])

  // Click outside handler for location suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch columns for selected space
  const { data: boardDetails } = useQuery({
    queryKey: ['columns', selectedSpaceId],
    queryFn: async () => {
      const cols = await columnsApi.list(selectedSpaceId)
      return { columns: cols }
    },
    enabled: !!selectedSpaceId,
  })

  // Fetch tags for selected space
  const { data: spaceTags } = useQuery({
    queryKey: ['tags', selectedSpaceId],
    queryFn: () => tagsApi.list(selectedSpaceId),
    enabled: !!selectedSpaceId,
  })

  // Fetch space members
  const { data: spaceDetails } = useQuery({
    queryKey: ['space', selectedSpaceId],
    queryFn: () => spacesApi.get(selectedSpaceId),
    enabled: !!selectedSpaceId,
  })

  // Set default column
  useEffect(() => {
    try {
      if (boardDetails?.columns && Array.isArray(boardDetails.columns) && boardDetails.columns.length > 0) {
        const inbox = boardDetails.columns.find((c: any) => c?.category === 'inbox')
        const firstNonArchive = boardDetails.columns.find((c: any) => c?.category !== 'archive')
        const defaultCol = inbox || firstNonArchive || boardDetails.columns[0]
        if (defaultCol?.id) {
          setSelectedColumnId(defaultCol.id)
        }
      }
    } catch (e) {
      console.error('Error setting column:', e)
    }
  }, [boardDetails])

  // Reset tags and assignees when space changes (but not on initial mount)
  const prevSpaceIdRef = useRef(selectedSpaceId)
  useEffect(() => {
    if (prevSpaceIdRef.current && prevSpaceIdRef.current !== selectedSpaceId) {
      setSelectedTagIds([])
      setSelectedAssigneeIds([])
      setSelectedColumnId('')
    }
    prevSpaceIdRef.current = selectedSpaceId
  }, [selectedSpaceId])

  // Click outside handler for assignee dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setShowAssigneeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedColumnId) throw new Error('No column selected')
      
      const cardData: any = {
        column_id: selectedColumnId,
        name,
        description: description || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        location: location || undefined,
      }

      const card = await cardsApi.create(cardData)

      if (selectedTagIds.length > 0) {
        await cardsApi.update(card.id, { tag_ids: selectedTagIds })
      }

      if (selectedAssigneeIds.length > 0) {
        await cardsApi.update(card.id, { assignee_ids: selectedAssigneeIds })
      }

      for (const task of tasks) {
        await cardsApi.addTask(card.id, { text: task.text })
      }

      return card
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns'] })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      onCreated()
    },
    onError: (error) => {
      console.error('Create error:', error)
      toast.error(t('common.operationFailed'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('cards.nameRequired'))
      return
    }
    createMutation.mutate()
  }

  const handleAddTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { text: newTask.trim(), completed: false }])
      setNewTask('')
    }
  }

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
  }

  // Safe data accessors
  const columns = Array.isArray(boardDetails?.columns) 
    ? boardDetails.columns.filter((c: any) => c?.category !== 'archive') 
    : []
  const members = Array.isArray(spaceDetails?.members) ? spaceDetails.members : []
  const tags = Array.isArray(spaceTags) ? spaceTags : []
  const spaces = Array.isArray(allSpaces) ? allSpaces : []

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 rounded-xl w-full max-w-2xl border border-dark-700 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-4 border-b border-dark-700 sticky top-0 bg-dark-800 z-10">
            <h2 className="text-lg font-semibold text-white">{t('cards.createCard')}</h2>
            <button type="button" onClick={onClose} className="p-1 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.cardName')} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                autoFocus
              />
            </div>

            {/* Space (global view only) */}
            {isGlobalView && spaces.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">{t('spaces.space')}</label>
                <select
                  value={selectedSpaceId}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                >
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>{space.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Column */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">{t('columns.column')}</label>
              <select
                value={selectedColumnId}
                onChange={(e) => setSelectedColumnId(e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
              >
                {columns.length === 0 ? (
                  <option value="">{t('common.loading')}</option>
                ) : (
                  columns.map((col: any) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))
                )}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white resize-none"
                rows={2}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.startDate')}</label>
                <DateTimePicker value={startDate} onChange={(val) => setStartDate(val || '')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.endDate')}</label>
                <DateTimePicker value={endDate} onChange={(val) => setEndDate(val || '')} />
              </div>
            </div>

            {/* Location with autocomplete */}
            <div ref={locationRef} className="relative">
              <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.location')}</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onFocus={() => locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                placeholder={t('cards.locationPlaceholder')}
              />
              {showLocationSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                  {locationSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        skipLocationFetch.current = true
                        setLocation(suggestion)
                        setLocationSuggestions([])
                        setShowLocationSuggestions(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:bg-dark-700 hover:text-white transition-colors border-b border-dark-700 last:border-b-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.tags')}</label>
                <div className="flex flex-wrap gap-2 p-2 bg-dark-900 border border-dark-600 rounded-lg">
                  {tags.map((tag: any) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelectedTagIds(prev => 
                        prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                      )}
                      className={`px-2 py-1 text-xs rounded-full ${selectedTagIds.includes(tag.id) ? 'ring-2' : 'opacity-60'}`}
                      style={{ backgroundColor: tag.color, color: isLightColor(tag.color) ? '#000' : '#fff' }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignees - Dropdown */}
            {members.length > 0 && (
              <div ref={assigneeDropdownRef} className="relative">
                <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.assignees')}</label>
                <button
                  type="button"
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-left text-sm text-dark-100 flex items-center justify-between"
                >
                  <span>
                    {selectedAssigneeIds.length > 0
                      ? `${selectedAssigneeIds.length} ${t('cards.assigneesSelected')}`
                      : t('cards.selectAssignees')}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAssigneeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showAssigneeDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-dark-800 border border-dark-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {members.map((member: any) => (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => {
                          if (member.user_id) {
                            setSelectedAssigneeIds(prev =>
                              prev.includes(member.user_id)
                                ? prev.filter(id => id !== member.user_id)
                                : [...prev, member.user_id]
                            )
                          }
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-dark-700 text-left"
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
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white" style={{backgroundColor: getAvatarColor(member.username || '?')}}>
                          {(member.username || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-dark-200">{member.username}</span>
                        <span className="text-xs text-dark-500">{member.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedAssigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {members
                      .filter((m: any) => selectedAssigneeIds.includes(m.user_id))
                      .map((member: any) => (
                        <span
                          key={member.user_id}
                          className="px-2 py-1 text-xs rounded-full bg-primary-600/20 text-primary-400 flex items-center gap-1"
                        >
                          {member.username}
                          <button
                            type="button"
                            onClick={() => setSelectedAssigneeIds(prev => prev.filter(id => id !== member.user_id))}
                            className="hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Tasks */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">{t('cards.tasks')}</label>
              <div className="bg-dark-900 border border-dark-600 rounded-lg">
                {tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-dark-700">
                    <input type="checkbox" checked={task.completed} onChange={() => {
                      const newTasks = [...tasks]
                      newTasks[i].completed = !newTasks[i].completed
                      setTasks(newTasks)
                    }} />
                    <span className={task.completed ? 'line-through text-dark-500' : 'text-white'}>{task.text}</span>
                    <button type="button" onClick={() => handleRemoveTask(i)} className="ml-auto text-dark-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 p-2">
                  <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                    className="flex-1 px-2 py-1 bg-transparent text-white text-sm"
                    placeholder={t('cards.addTask')}
                  />
                  <button type="button" onClick={handleAddTask} disabled={!newTask.trim()} className="text-primary-400 disabled:opacity-50">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-dark-700 sticky bottom-0 bg-dark-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim() || !selectedColumnId}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg"
            >
              {createMutation.isPending ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
