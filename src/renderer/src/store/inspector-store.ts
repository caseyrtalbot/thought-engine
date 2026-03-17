import { create } from 'zustand'

interface InspectorStore {
  readonly inspectorFile: { path: string; title: string } | null
  openInspector: (path: string, title: string) => void
  closeInspector: () => void
}

export const useInspectorStore = create<InspectorStore>((set) => ({
  inspectorFile: null,
  openInspector: (path, title) => set({ inspectorFile: { path, title } }),
  closeInspector: () => set({ inspectorFile: null })
}))
