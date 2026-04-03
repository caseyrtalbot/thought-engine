import { create } from 'zustand'

interface SidebarSelectionStore {
  /** Set of currently selected file paths. */
  readonly selectedPaths: ReadonlySet<string>
  /** Anchor path for shift-click range selection. */
  readonly anchorPath: string | null

  /** Toggle a single path in the selection (cmd-click). */
  toggle: (path: string) => void
  /** Set selection to a single path and update anchor. */
  selectOne: (path: string) => void
  /** Select a range of paths from anchor to target (shift-click). */
  selectRange: (targetPath: string, orderedPaths: readonly string[]) => void
  /** Clear all selection. */
  clear: () => void
}

export const useSidebarSelectionStore = create<SidebarSelectionStore>((set, get) => ({
  selectedPaths: new Set<string>(),
  anchorPath: null,

  toggle: (path) => {
    const next = new Set(get().selectedPaths)
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
    }
    set({ selectedPaths: next, anchorPath: path })
  },

  selectOne: (path) => {
    set({ selectedPaths: new Set([path]), anchorPath: path })
  },

  selectRange: (targetPath, orderedPaths) => {
    const anchor = get().anchorPath
    if (!anchor) {
      set({ selectedPaths: new Set([targetPath]), anchorPath: targetPath })
      return
    }

    const anchorIdx = orderedPaths.indexOf(anchor)
    const targetIdx = orderedPaths.indexOf(targetPath)
    if (anchorIdx === -1 || targetIdx === -1) {
      set({ selectedPaths: new Set([targetPath]), anchorPath: targetPath })
      return
    }

    const start = Math.min(anchorIdx, targetIdx)
    const end = Math.max(anchorIdx, targetIdx)
    const rangePaths = orderedPaths.slice(start, end + 1)

    // Merge with existing selection for additive range
    const next = new Set(get().selectedPaths)
    for (const p of rangePaths) {
      next.add(p)
    }
    set({ selectedPaths: next })
  },

  clear: () => {
    if (get().selectedPaths.size === 0) return
    set({ selectedPaths: new Set<string>(), anchorPath: null })
  }
}))
