import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type TabType = 'editor' | 'canvas' | 'skills' | 'claude-config' | 'project-canvas' | 'graph'

export interface ViewTab {
  readonly id: string
  readonly type: TabType
  readonly label: string
  readonly closeable: boolean
}

interface TabState {
  readonly tabs: readonly ViewTab[]
  readonly activeTabId: string
}

interface TabActions {
  openTab: (tab: ViewTab) => void
  activateTab: (id: string) => void
  closeTab: (id: string) => void
  reorderTab: (fromIndex: number, toIndex: number) => void
}

type TabStore = TabState & TabActions

export const TAB_DEFINITIONS: Record<TabType, { label: string; iconId: string }> = {
  editor: { label: 'Editor', iconId: 'editor' },
  canvas: { label: 'Vault Canvas', iconId: 'canvas' },
  skills: { label: 'Skills', iconId: 'skills' },
  'claude-config': { label: 'Claude Config', iconId: 'claude-config' },
  'project-canvas': { label: 'Project Canvas', iconId: 'project-canvas' },
  graph: { label: 'Graph', iconId: 'graph' }
}

const DEFAULT_TABS: readonly ViewTab[] = [
  { id: 'editor', type: 'editor', label: 'Editor', closeable: false },
  { id: 'canvas', type: 'canvas', label: 'Vault Canvas', closeable: true }
]

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: DEFAULT_TABS,
      activeTabId: 'editor',

      openTab: (tab) => {
        const { tabs } = get()
        const exists = tabs.find((t) => t.id === tab.id)
        if (exists) {
          set({ activeTabId: tab.id })
          return
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
      },

      activateTab: (id) => {
        const { tabs } = get()
        if (tabs.find((t) => t.id === id)) {
          set({ activeTabId: id })
        }
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get()
        const tab = tabs.find((t) => t.id === id)
        if (!tab || !tab.closeable) return

        const idx = tabs.indexOf(tab)
        const next = tabs.filter((t) => t.id !== id)

        let nextActive = activeTabId
        if (activeTabId === id) {
          // Activate nearest left neighbor, or right if leftmost
          const neighbor = next[Math.min(idx, next.length - 1)]
          nextActive = neighbor?.id ?? 'editor'
        }

        set({ tabs: next, activeTabId: nextActive })
      },

      reorderTab: (fromIndex, toIndex) => {
        const { tabs } = get()
        if (fromIndex < 0 || fromIndex >= tabs.length) return
        if (toIndex < 0 || toIndex >= tabs.length) return

        const updated = [...tabs]
        const [moved] = updated.splice(fromIndex, 1)
        updated.splice(toIndex, 0, moved)
        set({ tabs: updated })
      }
    }),
    {
      name: 'thought-engine-tabs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId
      })
    }
  )
)
