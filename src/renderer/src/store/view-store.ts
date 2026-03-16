import { create } from 'zustand'

export type ContentView = 'editor' | 'canvas' | 'skills'

interface ViewStore {
  readonly contentView: ContentView
  setContentView: (view: ContentView) => void
}

export const useViewStore = create<ViewStore>((set) => ({
  contentView: 'editor',
  setContentView: (view) => set({ contentView: view })
}))
