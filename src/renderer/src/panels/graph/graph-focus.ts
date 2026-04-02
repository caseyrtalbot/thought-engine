import { useGraphViewStore } from '@renderer/store/graph-view-store'

/**
 * Resolve the effective focus node index: hover takes priority, falls back to selection.
 * Returns the numeric index from the given map, or null if the effective id is absent.
 */
export function resolveFocusIdx(nodeIndexMap: Map<string, number>): number | null {
  const hoveredId = useGraphViewStore.getState().hoveredNodeId
  const selectedId = useGraphViewStore.getState().selectedNodeId
  const effectiveId = hoveredId ?? selectedId
  return effectiveId ? (nodeIndexMap.get(effectiveId) ?? null) : null
}
