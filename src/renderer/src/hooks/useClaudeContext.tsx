import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useCanvasStore } from '../store/canvas-store'
import { useVaultStore } from '../store/vault-store'
import { colors, typography } from '../design/tokens'
import type { CanvasNode } from '@shared/canvas-types'

export interface ClaudeContextResult {
  /** JSX for the title bar context summary. null for non-Claude cards. */
  readonly contextBadge: ReactNode
  /** Number of cards Claude can see. */
  readonly contextCardCount: number
  /** Whether context injection failed (sticky until card restart). */
  readonly contextError: boolean
  /** Mark context injection as failed (sticky). */
  readonly markError: () => void
}

/**
 * Manages spatial context for Claude terminal cards.
 *
 * Responsibilities:
 * - Subscribes to canvas store (fingerprint-based, only nodes/edges changes)
 * - Writes context file to .thought-engine/ on canvas changes
 * - Provides honest "Claude sees: N cards" badge for title bar
 * - Tracks context injection errors (sticky, not ephemeral)
 */
export function useClaudeContext(node: CanvasNode, isClaudeCard: boolean): ClaudeContextResult {
  const [contextCardCount, setContextCardCount] = useState(0)
  const [contextError, setContextError] = useState(false)
  const [wasTruncated, setWasTruncated] = useState(false)
  const vaultPath = useVaultStore((s) => s.vaultPath)
  // Track vaultPath in a ref so the cleanup effect reads the latest value
  const vaultPathRef = useRef(vaultPath)
  vaultPathRef.current = vaultPath

  // Auto-notify: rewrite context file when canvas cards or edges change.
  // Uses fingerprint pattern (plain subscribe + ref-gated comparison) because
  // the canvas store does not use subscribeWithSelector middleware.
  // Only node IDs+types and edge IDs are fingerprinted — moves/hovers are excluded.
  useEffect(() => {
    if (!isClaudeCard) return

    const getFingerprint = () => {
      const { nodes, edges } = useCanvasStore.getState()
      const nodeKey = nodes
        .filter((n) => n.id !== node.id && n.type !== 'terminal')
        .map((n) => `${n.id}:${n.type}`)
        .sort()
        .join(',')
      const edgeKey = edges
        .filter((e) => e.fromNode === node.id || e.toNode === node.id)
        .map((e) => e.id)
        .sort()
        .join(',')
      return `${nodeKey}|${edgeKey}`
    }
    let prevFingerprint = getFingerprint()

    // Track last nodes/edges refs to skip fingerprint recomputation on
    // viewport, hover, and selection changes (avoids O(n) on every frame)
    let lastNodesRef = useCanvasStore.getState().nodes
    let lastEdgesRef = useCanvasStore.getState().edges

    const unsub = useCanvasStore.subscribe((state) => {
      // Skip fingerprint computation if nodes/edges refs haven't changed
      if (state.nodes === lastNodesRef && state.edges === lastEdgesRef) return
      lastNodesRef = state.nodes
      lastEdgesRef = state.edges

      const curFingerprint = getFingerprint()
      if (curFingerprint === prevFingerprint) return
      prevFingerprint = curFingerprint

      import('../engine/context-serializer')
        .then(({ serializeNeighborhoodStructured }) => {
          const { nodes, edges } = useCanvasStore.getState()
          const result = serializeNeighborhoodStructured(node.id, nodes, edges)
          if (result.text && vaultPathRef.current) {
            const contextPath = `${vaultPathRef.current}/.thought-engine/context-${node.id}.txt`
            window.api.fs.writeFile(contextPath, result.text).catch(console.error)
          }
          setContextCardCount(result.cardCount)
          setWasTruncated(result.wasTruncated)
        })
        .catch(console.error)
    })

    return () => unsub()
  }, [isClaudeCard, node.id])

  // Clean up context file on unmount.
  // Uses ref for vaultPath so we read the latest value at cleanup time.
  useEffect(() => {
    if (!isClaudeCard) return
    return () => {
      const currentVaultPath = vaultPathRef.current ?? useVaultStore.getState().vaultPath
      if (currentVaultPath) {
        const contextPath = `${currentVaultPath}/.thought-engine/context-${node.id}.txt`
        window.api.fs.deleteFile(contextPath).catch(() => {})
      }
    }
  }, [isClaudeCard, node.id])

  // Mark error as sticky (cleared only on card restart, not on timer)
  const markError = useCallback(() => {
    setContextError(true)
  }, [])

  // Badge JSX for the title bar — no refresh button, no pulse animation
  const contextBadge = isClaudeCard ? (
    <span
      className="flex items-center gap-1 shrink-0 ml-2"
      title={
        contextError
          ? 'Context injection failed. Restart this Claude card to retry.'
          : wasTruncated
            ? `Claude sees ${contextCardCount} cards (some omitted for token budget)`
            : `Claude sees ${contextCardCount} cards on canvas`
      }
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: 6,
          height: 6,
          backgroundColor: contextError ? '#f59e0b' : colors.accent.default
        }}
      />
      <span
        style={{
          fontSize: 10,
          color: colors.text.muted,
          fontFamily: typography.fontFamily.mono
        }}
      >
        {contextCardCount}
        {wasTruncated ? '+' : ''}
      </span>
    </span>
  ) : null

  return { contextBadge, contextCardCount, contextError, markError }
}
