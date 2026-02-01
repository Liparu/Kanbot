import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { boardsApi } from '@/api/boards'
import KanbanBoard from './KanbanBoard'

export default function BoardPage() {
  const { t } = useTranslation()
  const { spaceId, boardId } = useParams<{ spaceId: string; boardId: string }>()

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ['boards', spaceId],
    queryFn: () => boardsApi.list(spaceId!),
    enabled: !!spaceId,
  })

  const mainBoardId = boardId || boards[0]?.id
  const { data: board, isLoading, error } = useQuery({
    queryKey: ['board', mainBoardId],
    queryFn: () => boardsApi.get(mainBoardId!),
    enabled: !!mainBoardId,
  })

  if (boardsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('common.loading')}</div>
      </div>
    )
  }

  if (!boardsLoading && boards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('boards.noBoards')}</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('common.loading')}</div>
      </div>
    )
  }

  if (error || !board) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('common.error')}</div>
      </div>
    )
  }

  return <KanbanBoard board={board} spaceId={spaceId} />
}
