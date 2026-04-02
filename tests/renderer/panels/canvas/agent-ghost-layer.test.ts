import { describe, it, expect } from 'vitest'
import {
  computeGhostNodes,
  computeGhostEdges,
  computeRemovedNodeIds
} from '../../../../src/renderer/src/panels/canvas/agent-ghost-layer'
import type { CanvasMutationPlan, CanvasMutationOp } from '@shared/canvas-mutation-types'
import type { CanvasNode } from '@shared/canvas-types'

function makePlan(ops: CanvasMutationOp[]): CanvasMutationPlan {
  return {
    id: 'test',
    operationId: 'test-op',
    source: 'agent',
    ops,
    summary: { addedNodes: 0, addedEdges: 0, movedNodes: 0, skippedFiles: 0, unresolvedRefs: 0 }
  }
}

function makeNode(id: string, w = 200, h = 100): CanvasNode {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    size: { width: w, height: h },
    content: `Content of ${id}`,
    metadata: {}
  }
}

const emptyNodes: readonly CanvasNode[] = []

describe('computeGhostNodes', () => {
  it('returns new nodes from add-node ops', () => {
    const plan = makePlan([
      {
        type: 'add-node',
        node: {
          id: 'n1',
          type: 'text',
          position: { x: 100, y: 200 },
          size: { width: 250, height: 120 },
          content: 'Ghost card',
          metadata: {}
        }
      }
    ])

    const ghosts = computeGhostNodes(plan, emptyNodes)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0].id).toBe('n1')
    expect(ghosts[0].position).toEqual({ x: 100, y: 200 })
    expect(ghosts[0].size).toEqual({ width: 250, height: 120 })
    expect(ghosts[0].content).toBe('Ghost card')
    expect(ghosts[0].isMoved).toBe(false)
  })

  it('returns moved node with real size from existing nodes', () => {
    const existingNodes = [makeNode('existing1', 300, 180)]
    const plan = makePlan([
      { type: 'move-node', nodeId: 'existing1', position: { x: 500, y: 300 } }
    ])

    const ghosts = computeGhostNodes(plan, existingNodes)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0].id).toBe('existing1')
    expect(ghosts[0].position).toEqual({ x: 500, y: 300 })
    expect(ghosts[0].size).toEqual({ width: 300, height: 180 })
    expect(ghosts[0].isMoved).toBe(true)
  })

  it('falls back to default size when moved node not found', () => {
    const plan = makePlan([{ type: 'move-node', nodeId: 'gone', position: { x: 500, y: 300 } }])

    const ghosts = computeGhostNodes(plan, emptyNodes)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0].size).toEqual({ width: 200, height: 100 })
  })

  it('ignores non-spatial ops', () => {
    const plan = makePlan([{ type: 'remove-edge', edgeId: 'e1' }])
    expect(computeGhostNodes(plan, emptyNodes)).toHaveLength(0)
  })
})

describe('computeGhostEdges', () => {
  it('returns new edges from add-edge ops', () => {
    const plan = makePlan([
      {
        type: 'add-edge',
        edge: {
          id: 'e1',
          fromNode: 'a',
          toNode: 'b',
          fromSide: 'bottom',
          toSide: 'top',
          kind: 'tension'
        }
      }
    ])

    const edges = computeGhostEdges(plan)
    expect(edges).toHaveLength(1)
    expect(edges[0].fromNode).toBe('a')
    expect(edges[0].kind).toBe('tension')
  })
})

describe('computeRemovedNodeIds', () => {
  it('returns IDs from remove-node ops', () => {
    const plan = makePlan([
      { type: 'remove-node', nodeId: 'x' },
      { type: 'remove-node', nodeId: 'y' }
    ])

    const removed = computeRemovedNodeIds(plan)
    expect(removed).toEqual(new Set(['x', 'y']))
  })

  it('returns empty set when no removals', () => {
    const plan = makePlan([{ type: 'move-node', nodeId: 'a', position: { x: 0, y: 0 } }])
    expect(computeRemovedNodeIds(plan)).toEqual(new Set())
  })
})
