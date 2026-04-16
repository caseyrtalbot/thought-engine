/**
 * Orchestrator hook for user-triggered agent actions.
 *
 * Manages the agent action lifecycle:
 * 1. Extract context from selected cards + 1-hop neighbors
 * 2. Send to main process via IPC for LLM computation
 * 3. Hold the resulting plan in preview state
 * 4. Apply or cancel on user decision
 *
 * During step 2, subscribes to `agent-action:stream` events and maintains
 * a `streamState` for the thought card (pure reducer in `agent-stream-state.ts`).
 *
 * Uses a phaseRef to guard the single-agent lock, avoiding stale
 * closure issues with React's useCallback batching.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store/canvas-store'
import { useVaultStore } from '../store/vault-store'
import { extractAgentContext, buildVaultScopeContext } from '../panels/canvas/agent-context'
import type { ArtifactSummary } from '../panels/canvas/agent-context'
import { applyAgentResult } from '../panels/canvas/agent-apply'
import {
  initialStreamState,
  reduceStream,
  type StreamState
} from '../panels/canvas/agent-stream-state'
import type { AgentActionName, AgentErrorTag } from '@shared/agent-action-types'
import type { CanvasMutationPlan } from '@shared/canvas-mutation-types'
import type { CommandStack } from '../panels/canvas/canvas-commands'
import { buildTagIndex } from '@shared/engine/tag-index'
import { buildGhostIndex } from '@shared/engine/ghost-index'

export type AgentPhase = 'idle' | 'computing' | 'preview' | 'error'

export interface AgentAnchor {
  readonly x: number // screen-space center x
  readonly y: number // screen-space y below which to place the card
}

export interface AgentOrchestratorState {
  readonly phase: AgentPhase
  readonly activeAction: AgentActionName | null
  readonly pendingPlan: CanvasMutationPlan | null
  readonly errorMessage: string | null
  readonly errorTag: AgentErrorTag | null
  readonly anchor: AgentAnchor | null
  readonly startedAt: number | null
}

const IDLE_STATE: AgentOrchestratorState = {
  phase: 'idle',
  activeAction: null,
  pendingPlan: null,
  errorMessage: null,
  errorTag: null,
  anchor: null,
  startedAt: null
}

export function useAgentOrchestrator(
  commandStack: React.RefObject<CommandStack | null>,
  containerSize: { width: number; height: number }
) {
  const [state, setState] = useState<AgentOrchestratorState>(IDLE_STATE)
  const [streamState, setStreamState] = useState<StreamState>(initialStreamState())

  // Ref mirrors state.phase so the trigger guard is never stale
  const phaseRef = useRef<AgentPhase>('idle')

  // Track spawned librarian/curator session IDs so the toolbar can show running state.
  // Set on spawn, cleared when the session exits (via agent:states-changed).
  const [librarianSessionId, setLibrarianSessionId] = useState<string | null>(null)
  const [curatorSessionId, setCuratorSessionId] = useState<string | null>(null)

  const setPhase = useCallback((next: AgentOrchestratorState) => {
    phaseRef.current = next.phase
    setState(next)
  }, [])

  // Subscribe once to agent stream events; reducer handles all state transitions
  useEffect(() => {
    const cleanup = window.api.on.agentActionStream((ev) => {
      setStreamState((prev) => reduceStream(prev, ev))
    })
    return cleanup
  }, [])

  const computeDefaultAnchor = useCallback((): AgentAnchor => {
    const { nodes, selectedNodeIds, viewport } = useCanvasStore.getState()
    if (selectedNodeIds.size > 0) {
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const node of nodes) {
        if (!selectedNodeIds.has(node.id)) continue
        minX = Math.min(minX, node.position.x)
        maxX = Math.max(maxX, node.position.x + node.size.width)
        minY = Math.min(minY, node.position.y)
        maxY = Math.max(maxY, node.position.y + node.size.height)
      }
      if (Number.isFinite(minX)) {
        const worldCx = (minX + maxX) / 2
        const worldCy = (minY + maxY) / 2
        return {
          x: worldCx * viewport.zoom + viewport.x,
          y: worldCy * viewport.zoom + viewport.y
        }
      }
    }
    // Vault-scope fallback: viewport center
    return { x: containerSize.width / 2, y: containerSize.height / 2 }
  }, [containerSize])

  const trigger = useCallback(
    async (action: AgentActionName, userPrompt?: string, anchor?: AgentAnchor) => {
      // Single agent lock — ref is always current, no stale closure risk
      if (phaseRef.current !== 'idle') return

      const { nodes, edges, selectedNodeIds, viewport } = useCanvasStore.getState()

      setStreamState(initialStreamState())
      setPhase({
        phase: 'computing',
        activeAction: action,
        pendingPlan: null,
        errorMessage: null,
        errorTag: null,
        anchor: anchor ?? computeDefaultAnchor(),
        startedAt: Date.now()
      })

      // For challenge/emerge with no selection, use vault-scope context
      // instead of sending empty card arrays
      const useVaultScope =
        (action === 'challenge' || action === 'emerge' || action === 'ask') &&
        selectedNodeIds.size === 0

      const context = useVaultScope
        ? (() => {
            const { artifacts, graph } = useVaultStore.getState()
            const summaries: readonly ArtifactSummary[] = artifacts.map((a) => ({
              id: a.id,
              title: a.title,
              type: a.type,
              signal: a.signal,
              tags: a.tags,
              origin: a.origin
            }))
            const tagTree = buildTagIndex(artifacts)
            const ghosts = buildGhostIndex(graph, artifacts)
            const viewportBounds = {
              x: -viewport.x / viewport.zoom,
              y: -viewport.y / viewport.zoom,
              width: containerSize.width / viewport.zoom,
              height: containerSize.height / viewport.zoom
            }
            return buildVaultScopeContext(action, summaries, tagTree, ghosts, {
              viewportBounds,
              totalCardCount: nodes.length
            })
          })()
        : extractAgentContext(action, nodes, edges, selectedNodeIds, viewport, containerSize)

      try {
        const response = await window.api.agentAction.compute({ action, context, userPrompt })

        if ('error' in response) {
          setPhase({
            phase: 'error',
            activeAction: action,
            pendingPlan: null,
            errorMessage: response.error,
            errorTag: response.tag ?? null,
            anchor: null,
            startedAt: null
          })
          return
        }

        setPhase({
          phase: 'preview',
          activeAction: action,
          pendingPlan: response.plan,
          errorMessage: null,
          errorTag: null,
          anchor: null,
          startedAt: null
        })
      } catch (err) {
        setPhase({
          phase: 'error',
          activeAction: action,
          pendingPlan: null,
          errorMessage: (err as Error).message,
          errorTag: null,
          anchor: null,
          startedAt: null
        })
      }
    },
    [containerSize, setPhase, computeDefaultAnchor]
  )

  const apply = useCallback(async () => {
    if (!state.pendingPlan || !commandStack.current) return
    try {
      await applyAgentResult(state.pendingPlan, commandStack.current)
    } catch (err) {
      console.error('[agent-orchestrator] apply failed:', err)
    }
    setPhase(IDLE_STATE)
  }, [state.pendingPlan, commandStack, setPhase])

  const cancel = useCallback(() => {
    if (phaseRef.current === 'computing') {
      window.api.agentAction.cancel()
    }
    setPhase(IDLE_STATE)
  }, [setPhase])

  return {
    ...state,
    streamState,
    librarianSessionId,
    setLibrarianSessionId,
    curatorSessionId,
    setCuratorSessionId,
    trigger,
    apply,
    cancel
  }
}
