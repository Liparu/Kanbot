import { useEffect, useRef, useCallback } from 'react'
import { useBoardStore } from '@/stores/boards'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'

interface WebSocketMessage {
  type: string
  card?: any
  card_id?: string
  column_id?: string
  from_column?: string
  to_column?: string
  position?: number
  column?: any
  notification?: any
  member?: any
  space_id?: string
  task?: any
  task_id?: string
  comment?: any
  tag?: any
  tag_id?: string
  initiated_by?: string
}

interface WebSocketCallbacks {
  onMemberAdded?: (member: any) => void
  onTaskCreated?: (cardId: string, task: any) => void
  onTaskUpdated?: (cardId: string, task: any) => void
  onTaskDeleted?: (cardId: string, taskId: string) => void
  onCommentCreated?: (cardId: string, comment: any) => void
  onCommentUpdated?: (cardId: string, comment: any) => void
  onCommentDeleted?: (cardId: string, comment: any) => void
  onTagCreated?: (tag: any) => void
  onTagUpdated?: (tag: any) => void
  onTagDeleted?: (tagId: string) => void
  onColumnUpdated?: (column: any) => void
}

export function useWebSocket(spaceId: string | undefined, callbacks?: WebSocketCallbacks) {
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 10
  
  const { addCard, updateCard, moveCard, removeCard, addColumn, removeColumn, updateColumn } = useBoardStore()
  const { addNotification } = useNotificationStore()
  const userId = useAuthStore((state) => state.user?.id)
  const token = useAuthStore((state) => state.token)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.initiated_by === userId) {
      return
    }

    switch (message.type) {
      case 'card_created':
        if (message.card) {
          addCard(message.card.column_id, message.card)
        }
        break

      case 'card_updated':
        if (message.card) {
          updateCard(message.card.column_id, message.card.id, message.card)
        }
        break

      case 'card_moved':
        if (message.card_id && message.from_column && message.to_column && message.position !== undefined) {
          moveCard(message.from_column, message.to_column, message.card_id, message.position)
        }
        break

      case 'card_deleted':
        if (message.card_id && message.column_id) {
          removeCard(message.column_id, message.card_id)
        }
        break

      case 'column_created':
        if (message.column) {
          addColumn(message.column)
        }
        break

      case 'column_updated':
        if (message.column) {
          updateColumn(message.column.id, message.column)
          callbacksRef.current?.onColumnUpdated?.(message.column)
        }
        break

      case 'column_deleted':
        if (message.column_id) {
          removeColumn(message.column_id)
        }
        break

      case 'notification_created':
        if (message.notification && message.notification.user_id === userId) {
          addNotification(message.notification)
        }
        break

      case 'member_added':
        if (message.member) {
          callbacksRef.current?.onMemberAdded?.(message.member)
        }
        break

      case 'task_created':
        if (message.card_id && message.task) {
          callbacksRef.current?.onTaskCreated?.(message.card_id, message.task)
        }
        break

      case 'task_updated':
        if (message.card_id && message.task) {
          callbacksRef.current?.onTaskUpdated?.(message.card_id, message.task)
        }
        break

      case 'task_deleted':
        if (message.card_id && message.task_id) {
          callbacksRef.current?.onTaskDeleted?.(message.card_id, message.task_id)
        }
        break

      case 'comment_created':
        if (message.card_id && message.comment) {
          callbacksRef.current?.onCommentCreated?.(message.card_id, message.comment)
        }
        break

      case 'comment_updated':
        if (message.card_id && message.comment) {
          callbacksRef.current?.onCommentUpdated?.(message.card_id, message.comment)
        }
        break

      case 'comment_deleted':
        if (message.card_id && message.comment) {
          callbacksRef.current?.onCommentDeleted?.(message.card_id, message.comment)
        }
        break

      case 'tag_created':
        if (message.tag) {
          callbacksRef.current?.onTagCreated?.(message.tag)
        }
        break

      case 'tag_updated':
        if (message.tag) {
          callbacksRef.current?.onTagUpdated?.(message.tag)
        }
        break

      case 'tag_deleted':
        if (message.tag_id) {
          callbacksRef.current?.onTagDeleted?.(message.tag_id)
        }
        break

      default:
        if (message.type !== 'pong') {
          console.log('Unknown WebSocket message type:', message.type)
        }
    }
  }, [addCard, updateCard, moveCard, removeCard, addColumn, removeColumn, updateColumn, addNotification, userId])

  const startHeartbeat = useCallback((ws: WebSocket) => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
    }
    
    heartbeatRef.current = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping')
      }
    }, 30000)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!spaceId || !token) return

    const wsHost = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '').replace(/\/api\/v1$/, '')
      : window.location.host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${wsHost}/ws/${spaceId}?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected to space:', spaceId)
      reconnectAttempts.current = 0
      startHeartbeat(ws)
    }

    ws.onmessage = (event) => {
      try {
        if (event.data === 'pong') {
          return
        }
        const message: WebSocketMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onclose = (event) => {
      stopHeartbeat()
      
      if (event.code === 4001) {
        console.error('WebSocket authentication failed')
        return
      }
      
      if (event.code === 4003) {
        console.error('WebSocket access denied to space')
        return
      }
      
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        console.log(`WebSocket disconnected, reconnecting in ${delay}ms...`)
        reconnectAttempts.current++
        setTimeout(() => {
          if (wsRef.current === ws || wsRef.current === null) {
            connect()
          }
        }, delay)
      } else {
        console.error('Max reconnection attempts reached')
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    wsRef.current = ws
  }, [spaceId, token, handleMessage, startHeartbeat, stopHeartbeat])

  useEffect(() => {
    connect()

    return () => {
      stopHeartbeat()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect, stopHeartbeat])

  return wsRef.current
}
