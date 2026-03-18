import { create } from 'zustand'
import type { ClaudeActivityEvent } from '@shared/ipc-channels'
import type { CanvasNode } from '@shared/canvas-types'

function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? path : path.slice(idx + 1)
}

const MAX_RECENT_EVENTS = 50

interface ClaudeActivityStore {
  readonly activeNodeIds: ReadonlySet<string>
  readonly recentEvents: readonly ClaudeActivityEvent[]
  readonly sessionActive: boolean

  processEvent: (event: ClaudeActivityEvent, nodes: readonly CanvasNode[]) => readonly string[]
  deactivateNode: (nodeId: string) => void
  setSessionActive: (active: boolean) => void
  clearAll: () => void
}

/**
 * Match a ClaudeActivityEvent to canvas nodes.
 * Returns the IDs of nodes that should glow.
 */
function matchEventToNodes(
  event: ClaudeActivityEvent,
  nodes: readonly CanvasNode[]
): readonly string[] {
  const matched: string[] = []

  for (const node of nodes) {
    // Path match: node content is a file path that matches the event's filePath
    if (event.filePath && node.content && event.filePath.endsWith(node.content)) {
      matched.push(node.id)
      continue
    }

    // For config-changed events, match by filename in node content
    if (event.kind === 'config-changed' && event.filePath && node.content) {
      const eventFile = basename(event.filePath)
      const nodeFile = basename(node.content)
      if (eventFile === nodeFile && eventFile.length > 0) {
        matched.push(node.id)
        continue
      }
    }

    // Name match for prompt events: scan prompt text for /commandName or agent names
    if (event.kind === 'prompt' && event.promptText) {
      const meta = node.metadata
      const promptLower = event.promptText.toLowerCase()

      // Match /commandName
      if (meta?.commandName && typeof meta.commandName === 'string') {
        if (promptLower.includes('/' + meta.commandName.toLowerCase())) {
          matched.push(node.id)
          continue
        }
      }

      // Match agent name
      if (meta?.agentName && typeof meta.agentName === 'string') {
        if (promptLower.includes(meta.agentName.toLowerCase())) {
          matched.push(node.id)
          continue
        }
      }

      // Match skill name
      if (meta?.skillName && typeof meta.skillName === 'string') {
        if (promptLower.includes(meta.skillName.toLowerCase())) {
          matched.push(node.id)
          continue
        }
      }
    }
  }

  return matched
}

export const useClaudeActivityStore = create<ClaudeActivityStore>((set) => ({
  activeNodeIds: new Set<string>(),
  recentEvents: [],
  sessionActive: false,

  processEvent: (event, nodes) => {
    const matched = matchEventToNodes(event, nodes)

    set((s) => {
      const nextActive = new Set(s.activeNodeIds)
      for (const id of matched) {
        nextActive.add(id)
      }
      const nextEvents = [event, ...s.recentEvents].slice(0, MAX_RECENT_EVENTS)
      return {
        activeNodeIds: nextActive,
        recentEvents: nextEvents,
        sessionActive:
          event.kind === 'session-start'
            ? true
            : event.kind === 'session-end'
              ? false
              : s.sessionActive
      }
    })

    return matched
  },

  deactivateNode: (nodeId) =>
    set((s) => {
      const next = new Set(s.activeNodeIds)
      next.delete(nodeId)
      return { activeNodeIds: next }
    }),

  setSessionActive: (active) => set({ sessionActive: active }),

  clearAll: () =>
    set({
      activeNodeIds: new Set<string>(),
      recentEvents: [],
      sessionActive: false
    })
}))
