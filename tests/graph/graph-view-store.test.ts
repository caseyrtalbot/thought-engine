import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphViewStore } from '@renderer/store/graph-view-store'

describe('graph-view-store', () => {
  beforeEach(() => {
    useGraphViewStore.getState().reset()
  })

  it('initializes with no hovered or selected node', () => {
    const state = useGraphViewStore.getState()
    expect(state.hoveredNodeId).toBeNull()
    expect(state.selectedNodeId).toBeNull()
    expect(state.alpha).toBe(0)
    expect(state.settled).toBe(true)
  })

  it('sets and clears hovered node', () => {
    useGraphViewStore.getState().setHoveredNode('node-1')
    expect(useGraphViewStore.getState().hoveredNodeId).toBe('node-1')
    useGraphViewStore.getState().setHoveredNode(null)
    expect(useGraphViewStore.getState().hoveredNodeId).toBeNull()
  })

  it('sets and clears selected node', () => {
    useGraphViewStore.getState().setSelectedNode('node-2')
    expect(useGraphViewStore.getState().selectedNodeId).toBe('node-2')
    useGraphViewStore.getState().setSelectedNode(null)
    expect(useGraphViewStore.getState().selectedNodeId).toBeNull()
  })

  it('tracks simulation alpha and settled state', () => {
    useGraphViewStore.getState().setSimulationState(0.5, false)
    const s = useGraphViewStore.getState()
    expect(s.alpha).toBe(0.5)
    expect(s.settled).toBe(false)
  })

  it('stores viewport state', () => {
    useGraphViewStore.getState().setViewport({ x: 100, y: 200, scale: 1.5 })
    const vp = useGraphViewStore.getState().viewport
    expect(vp).toEqual({ x: 100, y: 200, scale: 1.5 })
  })

  it('tracks node count and edge count', () => {
    useGraphViewStore.getState().setGraphStats(42, 87)
    const s = useGraphViewStore.getState()
    expect(s.nodeCount).toBe(42)
    expect(s.edgeCount).toBe(87)
  })

  it('reset clears all state', () => {
    useGraphViewStore.getState().setHoveredNode('x')
    useGraphViewStore.getState().setSelectedNode('y')
    useGraphViewStore.getState().setSimulationState(0.8, false)
    useGraphViewStore.getState().reset()
    const s = useGraphViewStore.getState()
    expect(s.hoveredNodeId).toBeNull()
    expect(s.selectedNodeId).toBeNull()
    expect(s.alpha).toBe(0)
  })
})
