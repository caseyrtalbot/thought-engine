import { create } from 'zustand'

interface SidebarSelectionStore {
  /** Set of currently selected file paths. */
  readonly selectedPaths: ReadonlySet<string>
  /** Anchor path for shift-click range selection. */
  readonly anchorPath: string | null
  /** True when a vault agent (librarian/curator) is actively running. */
  readonly agentActive: boolean
  /** Label of the currently active vault agent (e.g. 'librarian', 'curator'). */
  readonly activeAgentLabel: string | null
  /** Paths modified by agent runs, awaiting user review. */
  readonly agentModifiedPaths: ReadonlySet<string>
  /** Maps file paths to the action/agent that last touched them (e.g. 'challenge', 'curator'). */
  readonly actionedPaths: ReadonlyMap<string, string>

  /** Toggle a single path in the selection (cmd-click). */
  toggle: (path: string) => void
  /** Set selection to a single path and update anchor. */
  selectOne: (path: string) => void
  /** Select a range of paths from anchor to target (shift-click). */
  selectRange: (targetPath: string, orderedPaths: readonly string[]) => void
  /** Clear all selection. */
  clear: () => void
  /** Set whether a vault agent is actively running and which one. */
  setAgentActive: (active: boolean, label?: string) => void
  /** Mark paths as agent-modified (with optional action label for icon coloring). */
  markAgentModified: (paths: readonly string[], actionLabel?: string) => void
  /** Clear a single path from agent-modified set (user reviewed it). */
  clearAgentModified: (path: string) => void
}

function loadAgentModified(): Set<string> {
  try {
    const raw = localStorage.getItem('te:agent-modified-paths')
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {
    /* ignore */
  }
  return new Set()
}

function persistAgentModified(paths: ReadonlySet<string>): void {
  localStorage.setItem('te:agent-modified-paths', JSON.stringify([...paths]))
}

function loadActionedPaths(): Map<string, string> {
  try {
    const raw = localStorage.getItem('te:actioned-paths')
    if (raw) return new Map(JSON.parse(raw) as [string, string][])
  } catch {
    /* ignore */
  }
  return new Map()
}

function persistActionedPaths(paths: ReadonlyMap<string, string>): void {
  localStorage.setItem('te:actioned-paths', JSON.stringify([...paths]))
}

export const useSidebarSelectionStore = create<SidebarSelectionStore>((set, get) => ({
  selectedPaths: new Set<string>(),
  anchorPath: null,
  agentActive: false,
  activeAgentLabel: null,
  agentModifiedPaths: loadAgentModified(),
  actionedPaths: loadActionedPaths(),

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
  },

  setAgentActive: (active, label) =>
    set({ agentActive: active, activeAgentLabel: active ? (label ?? null) : null }),

  markAgentModified: (paths, actionLabel) => {
    const next = new Set(get().agentModifiedPaths)
    for (const p of paths) next.add(p)
    persistAgentModified(next)

    // Track which action touched these paths
    if (actionLabel) {
      const nextActioned = new Map(get().actionedPaths)
      for (const p of paths) nextActioned.set(p, actionLabel)
      persistActionedPaths(nextActioned)
      set({ agentModifiedPaths: next, actionedPaths: nextActioned })
    } else {
      set({ agentModifiedPaths: next })
    }
  },

  clearAgentModified: (path) => {
    const next = new Set(get().agentModifiedPaths)
    next.delete(path)
    persistAgentModified(next)

    const nextActioned = new Map(get().actionedPaths)
    nextActioned.delete(path)
    persistActionedPaths(nextActioned)
    set({ agentModifiedPaths: next, actionedPaths: nextActioned })
  }
}))
