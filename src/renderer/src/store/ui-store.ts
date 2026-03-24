import { create } from 'zustand'
import { getUiState, updateUiState } from './vault-persist'

interface UiStore {
  readonly backlinkCollapsed: Readonly<Record<string, boolean>>

  getBacklinkCollapsed: (notePath: string) => boolean
  toggleBacklinkCollapsed: (notePath: string) => void
  rehydrate: (backlinkCollapsed: Record<string, boolean>) => void
}

export const useUiStore = create<UiStore>((set, get) => ({
  backlinkCollapsed: {},

  getBacklinkCollapsed: (notePath) => get().backlinkCollapsed[notePath] ?? true,

  toggleBacklinkCollapsed: (notePath) => {
    const current = get().backlinkCollapsed[notePath] ?? true
    const next = { ...get().backlinkCollapsed, [notePath]: !current }
    set({ backlinkCollapsed: next })
    updateUiState({ backlinkCollapsed: next })
  },

  rehydrate: (backlinkCollapsed) => {
    set({ backlinkCollapsed })
  }
}))

/**
 * Rehydrate ui-store from persisted VaultState.
 * Call after vault load completes.
 */
export function rehydrateUiStore(): void {
  const persisted = getUiState()
  useUiStore.getState().rehydrate(persisted.backlinkCollapsed ?? {})
}
