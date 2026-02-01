import { create } from 'zustand'
import { arrayMove } from '@dnd-kit/sortable'
import type { Board, Column, Card } from '@/types'

interface BoardState {
  boards: Board[]
  currentBoard: Board | null
  columns: Column[]
  cards: Record<string, Card[]>

  setBoards: (boards: Board[]) => void
  setCurrentBoard: (board: Board | null) => void
  setColumns: (columns: Column[]) => void
  setCards: (columnId: string, cards: Card[]) => void
  
  addColumn: (column: Column) => void
  updateColumn: (columnId: string, data: Partial<Column>) => void
  removeColumn: (columnId: string) => void
  
  addCard: (columnId: string, card: Card) => void
  updateCard: (columnId: string, cardId: string, data: Partial<Card>) => void
  moveCard: (fromColumnId: string, toColumnId: string, cardId: string, newPosition: number) => void
  removeCard: (columnId: string, cardId: string) => void
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  currentBoard: null,
  columns: [],
  cards: {},

  setBoards: (boards) => set({ boards }),

  setCurrentBoard: (board) => set({ currentBoard: board }),

  setColumns: (columns) => set({ columns }),

  setCards: (columnId, cards) =>
    set((state) => ({
      cards: { ...state.cards, [columnId]: cards },
    })),

  addColumn: (column) =>
    set((state) => ({
      columns: [...state.columns, column],
      cards: { ...state.cards, [column.id]: [] },
    })),

  updateColumn: (columnId, data) =>
    set((state) => ({
      columns: state.columns.map((c) =>
        c.id === columnId ? { ...c, ...data } : c
      ),
    })),

  removeColumn: (columnId) =>
    set((state) => {
      const { [columnId]: _, ...remainingCards } = state.cards
      return {
        columns: state.columns.filter((c) => c.id !== columnId),
        cards: remainingCards,
      }
    }),

  addCard: (columnId, card) =>
    set((state) => {
      const existing = (state.cards[columnId] || []).some((c) => c.id === card.id)
      if (existing) {
        return state
      }
      return {
        cards: {
          ...state.cards,
          [columnId]: [...(state.cards[columnId] || []), card],
        },
      }
    }),

  updateCard: (columnId, cardId, data) =>
    set((state) => {
      const updatedColumnCards = (state.cards[columnId] || []).map((c) =>
        c.id === cardId ? { ...c, ...data } : c
      )
      const finalCards = { ...state.cards, [columnId]: updatedColumnCards }

      if (data.column_id && data.column_id !== columnId) {
        const newColumnId = data.column_id
        const movedCard = updatedColumnCards.find((c) => c.id === cardId)
        const remaining = updatedColumnCards.filter((c) => c.id !== cardId)
        const destCards = [...(state.cards[newColumnId] || []), movedCard].filter(Boolean) as Card[]
        return {
          cards: {
            ...finalCards,
            [columnId]: remaining,
            [newColumnId]: destCards,
          },
        }
      }

      return { cards: finalCards }
    }),

  moveCard: (fromColumnId, toColumnId, cardId, newPosition) =>
    set((state) => {
      if (fromColumnId === toColumnId) {
        const currentCards = [...(state.cards[fromColumnId] || [])]
        const fromIndex = currentCards.findIndex((c) => c.id === cardId)
        if (fromIndex === -1) return state
        const clampedIndex = Math.max(0, Math.min(newPosition, currentCards.length - 1))
        const reordered = arrayMove(currentCards, fromIndex, clampedIndex).map((c, idx) => ({
          ...c,
          position: idx,
        }))
        return {
          cards: { ...state.cards, [fromColumnId]: reordered },
        }
      }

      const sourceCards = [...(state.cards[fromColumnId] || [])]
      const cardIndex = sourceCards.findIndex((c) => c.id === cardId)
      if (cardIndex === -1) return state

      const [card] = sourceCards.splice(cardIndex, 1)
      const destCards = [...(state.cards[toColumnId] || [])]
      const insertIndex = Math.max(0, Math.min(newPosition, destCards.length))
      const updatedCard = { ...card, column_id: toColumnId, position: insertIndex }
      destCards.splice(insertIndex, 0, updatedCard)

      const reorderedSource = sourceCards.map((c, idx) => ({ ...c, position: idx }))
      const reorderedDest = destCards.map((c, idx) => ({ ...c, position: idx }))

      return {
        cards: {
          ...state.cards,
          [fromColumnId]: reorderedSource,
          [toColumnId]: reorderedDest,
        },
      }
    }),

  removeCard: (columnId, cardId) =>
    set((state) => ({
      cards: {
        ...state.cards,
        [columnId]: (state.cards[columnId] || []).filter((c) => c.id !== cardId),
      },
    })),
}))
