import { describe, it, expect } from 'vitest'
import { graphToCanvas } from '../../src/renderer/src/panels/canvas/graph-to-canvas'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '../../src/shared/types'

function makeNode(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    title: overrides.id,
    type: 'note',
    signal: 'untested',
    connectionCount: 0,
    ...overrides
  }
}

function makeEdge(source: string, target: string): GraphEdge {
  return { source, target, kind: 'connection' }
}

/** Helper: build an idToPath map from id -> path */
function pathMap(entries: [string, string][]): Map<string, string> {
  return new Map(entries)
}

const EMPTY_PATHS = new Map<string, string>()

describe('graphToCanvas', () => {
  it('empty graph produces empty canvas', () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [] }
    const result = graphToCanvas(graph, EMPTY_PATHS)

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })

  it('single node produces one canvas node at origin', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'n1', title: 'First Note' })],
      edges: []
    }
    const idToPath = pathMap([['n1', '/vault/first-note.md']])
    const result = graphToCanvas(graph, idToPath)

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].type).toBe('note')
    expect(result.nodes[0].content).toBe('/vault/first-note.md')
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 })
  })

  it('sets content to empty string when path is missing', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'ghost', title: 'Ghost Node' })],
      edges: []
    }
    const result = graphToCanvas(graph, EMPTY_PATHS)

    expect(result.nodes[0].content).toBe('')
  })

  it('two connected nodes produce two canvas nodes and one edge', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'a', title: 'Node A' }), makeNode({ id: 'b', title: 'Node B' })],
      edges: [makeEdge('a', 'b')]
    }
    const result = graphToCanvas(graph, EMPTY_PATHS)

    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)

    const edge = result.edges[0]
    const nodeIds = new Set(result.nodes.map((n) => n.id))
    expect(nodeIds.has(edge.fromNode)).toBe(true)
    expect(nodeIds.has(edge.toNode)).toBe(true)
    expect(edge.fromSide).toBe('right')
    expect(edge.toSide).toBe('left')
  })

  it('node positions form a grid pattern', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => makeNode({ id: `n${i}`, title: `Node ${i}` }))
    const graph: KnowledgeGraph = { nodes, edges: [] }
    const result = graphToCanvas(graph, EMPTY_PATHS)

    expect(result.nodes).toHaveLength(5)

    // 5 nodes -> ceil(sqrt(5)) = 3 columns
    // Row 0: cols 0,1,2 -> positions (0,0), (360,0), (720,0)
    // Row 1: cols 0,1   -> positions (0,280), (360,280)
    const positions = result.nodes.map((n) => n.position)
    expect(positions[0]).toEqual({ x: 0, y: 0 })
    expect(positions[1]).toEqual({ x: 360, y: 0 })
    expect(positions[2]).toEqual({ x: 720, y: 0 })
    expect(positions[3]).toEqual({ x: 0, y: 280 })
    expect(positions[4]).toEqual({ x: 360, y: 280 })
  })

  it('edge IDs map correctly between graph and canvas', () => {
    const graph: KnowledgeGraph = {
      nodes: [
        makeNode({ id: 'x', title: 'X' }),
        makeNode({ id: 'y', title: 'Y' }),
        makeNode({ id: 'z', title: 'Z' })
      ],
      edges: [makeEdge('x', 'y'), makeEdge('y', 'z')]
    }
    const result = graphToCanvas(graph, EMPTY_PATHS)

    expect(result.edges).toHaveLength(2)

    // Build a lookup from graphNodeId metadata to canvas node id
    const canvasNodeByGraphId = new Map<string, string>()
    for (const cNode of result.nodes) {
      const graphId = (cNode.metadata as Record<string, unknown>).graphNodeId as string
      canvasNodeByGraphId.set(graphId, cNode.id)
    }

    // First edge: x -> y
    expect(result.edges[0].fromNode).toBe(canvasNodeByGraphId.get('x'))
    expect(result.edges[0].toNode).toBe(canvasNodeByGraphId.get('y'))

    // Second edge: y -> z
    expect(result.edges[1].fromNode).toBe(canvasNodeByGraphId.get('y'))
    expect(result.edges[1].toNode).toBe(canvasNodeByGraphId.get('z'))
  })

  it('skips edges when source or target node is missing from graph', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'a', title: 'A' })],
      edges: [makeEdge('a', 'missing')]
    }
    const result = graphToCanvas(graph, EMPTY_PATHS)

    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toHaveLength(0)
  })

  it('preserves artifact type and signal in metadata', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'g1', title: 'Gene', type: 'gene', signal: 'validated' })],
      edges: []
    }
    const result = graphToCanvas(graph, EMPTY_PATHS)
    const meta = result.nodes[0].metadata as Record<string, unknown>

    expect(meta.graphNodeId).toBe('g1')
    expect(meta.artifactType).toBe('gene')
    expect(meta.signal).toBe('validated')
  })

  it('uses vault file path as content when available', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'r1', title: 'Research Node', type: 'research' })],
      edges: []
    }
    const idToPath = pathMap([['r1', '/vault/research/deep-learning.md']])
    const result = graphToCanvas(graph, idToPath)

    expect(result.nodes[0].content).toBe('/vault/research/deep-learning.md')
  })

  it('returns immutable result (new arrays, not references to input)', () => {
    const nodes = [makeNode({ id: 'a', title: 'A' })]
    const edges = [makeEdge('a', 'a')]
    const graph: KnowledgeGraph = { nodes, edges }
    const result = graphToCanvas(graph, EMPTY_PATHS)

    // Result arrays should be new references
    expect(result.nodes).not.toBe(nodes)
    expect(result.edges).not.toBe(edges)
  })

  it('applies origin offset to node positions', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'a', title: 'A' })],
      edges: []
    }
    const result = graphToCanvas(graph, EMPTY_PATHS, { x: 500, y: 100 })
    expect(result.nodes[0].position.x).toBe(500)
    expect(result.nodes[0].position.y).toBe(100)
  })
})
