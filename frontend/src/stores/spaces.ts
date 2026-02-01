import { create } from 'zustand'
import type { Space } from '@/types'

interface SpaceState {
  spaces: Space[]
  currentSpaceId: string | null
  setSpaces: (spaces: Space[]) => void
  addSpace: (space: Space) => void
  updateSpace: (spaceId: string, data: Partial<Space>) => void
  removeSpace: (spaceId: string) => void
  setCurrentSpace: (spaceId: string | null) => void
  getCurrentSpace: () => Space | undefined
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  currentSpaceId: null,

  setSpaces: (spaces) => set({ spaces }),

  addSpace: (space) =>
    set((state) => ({
      spaces: [...state.spaces, space],
    })),

  updateSpace: (spaceId, data) =>
    set((state) => ({
      spaces: state.spaces.map((s) =>
        s.id === spaceId ? { ...s, ...data } : s
      ),
    })),

  removeSpace: (spaceId) =>
    set((state) => ({
      spaces: state.spaces.filter((s) => s.id !== spaceId),
      currentSpaceId:
        state.currentSpaceId === spaceId ? null : state.currentSpaceId,
    })),

  setCurrentSpace: (spaceId) => set({ currentSpaceId: spaceId }),

  getCurrentSpace: () => {
    const state = get()
    return state.spaces.find((s) => s.id === state.currentSpaceId)
  },
}))
