import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import KanbanBoard from './KanbanBoard'

export default function BoardPage() {
  const { t } = useTranslation()
  const { spaceId } = useParams<{ spaceId: string }>()

  if (!spaceId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-400">{t('common.error')}</div>
      </div>
    )
  }

  return <KanbanBoard spaceId={spaceId} />
}
