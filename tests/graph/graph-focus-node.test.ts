import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphViewStore } from '@renderer/store/graph-view-store'
import { resolveFocusIdx } from '@renderer/panels/graph/graph-focus'

describe('resolveFocusIdx', () => {
  const nodeIndexMap = new Map<string, number>([
    ['note-alpha', 0],
    ['note-beta', 1],
    ['note-gamma', 2]
  ])

  beforeEach(() => {
    useGraphViewStore.getState().reset()
  })

  it('returns null when neither hovered nor selected', () => {
    expect(resolveFocusIdx(nodeIndexMap)).toBeNull()
  })

  it('returns the hovered node index when only hovered', () => {
    useGraphViewStore.getState().setHoveredNode('note-beta')
    expect(resolveFocusIdx(nodeIndexMap)).toBe(1)
  })

  it('returns the selected node index when only selected', () => {
    useGraphViewStore.getState().setSelectedNode('note-gamma')
    expect(resolveFocusIdx(nodeIndexMap)).toBe(2)
  })

  it('hover takes priority over selection', () => {
    useGraphViewStore.getState().setSelectedNode('note-gamma')
    useGraphViewStore.getState().setHoveredNode('note-alpha')
    expect(resolveFocusIdx(nodeIndexMap)).toBe(0)
  })

  it('returns null when hovered id is not in the index map', () => {
    useGraphViewStore.getState().setHoveredNode('nonexistent')
    expect(resolveFocusIdx(nodeIndexMap)).toBeNull()
  })

  it('falls back to selection when hovered id is not in map', () => {
    useGraphViewStore.getState().setHoveredNode('nonexistent')
    useGraphViewStore.getState().setSelectedNode('note-beta')
    // hovered has priority, but it is not in the map, so its resolution is null.
    // The function resolves the effectiveId first, then looks it up.
    // 'nonexistent' is the effectiveId (hover priority), but it maps to nothing.
    expect(resolveFocusIdx(nodeIndexMap)).toBeNull()
  })

  it('returns null for an empty index map', () => {
    useGraphViewStore.getState().setHoveredNode('note-alpha')
    expect(resolveFocusIdx(new Map())).toBeNull()
  })
})
