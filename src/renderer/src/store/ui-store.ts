import { create } from 'zustand'
import { getUiState, updateUiState } from './vault-persist'

interface UiStore {
  readonly backlinkCollapsed: Readonly<Record<string, boolean>>
  readonly dismissedGhosts: readonly string[]

  getBacklinkCollapsed: (notePath: string) => boolean
  toggleBacklinkCollapsed: (notePath: string) => void
  dismissGhost: (id: string) => void
  undismissGhost: (id: string) => void
  isGhostDismissed: (id: string) => boolean
  rehydrate: (
    backlinkCollapsed: Record<string, boolean>,
    dismissedGhosts: readonly string[]
  ) => void
}

export const useUiStore = create<UiStore>((set, get) => ({
  backlinkCollapsed: {},
  dismissedGhosts: [],

  getBacklinkCollapsed: (notePath) => get().backlinkCollapsed[notePath] ?? true,

  toggleBacklinkCollapsed: (notePath) => {
    const current = get().backlinkCollapsed[notePath] ?? true
    const next = { ...get().backlinkCollapsed, [notePath]: !current }
    set({ backlinkCollapsed: next })
    updateUiState({ backlinkCollapsed: next })
  },

  dismissGhost: (id) => {
    const current = get().dismissedGhosts
    if (current.includes(id)) return
    const next = [...current, id]
    set({ dismissedGhosts: next })
    updateUiState({ dismissedGhosts: next })
  },

  undismissGhost: (id) => {
    const next = get().dismissedGhosts.filter((g) => g !== id)
    set({ dismissedGhosts: next })
    updateUiState({ dismissedGhosts: next })
  },

  isGhostDismissed: (id) => get().dismissedGhosts.includes(id),

  rehydrate: (backlinkCollapsed, dismissedGhosts) => {
    set({ backlinkCollapsed, dismissedGhosts: [...dismissedGhosts] })
  }
}))

/**
 * Rehydrate ui-store from persisted VaultState.
 * Call after vault load completes.
 */
export function rehydrateUiStore(): void {
  const persisted = getUiState()
  useUiStore
    .getState()
    .rehydrate(persisted.backlinkCollapsed ?? {}, persisted.dismissedGhosts ?? [])
}
