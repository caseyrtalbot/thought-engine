import { describe, it, expect } from 'vitest'
import type { KnowledgeGraph, GraphNode, GraphEdge, Artifact } from '../../src/shared/types'
import type { CanvasNode } from '../../src/shared/canvas-types'
import {
  buildIdToPath,
  computeImportViewport,
  computeImportNodes,
  computeOriginOffset,
  collectUniqueTags,
  IMPORT_CAP,
  HUB_COUNT,
  IMPORT_FILTERS
} from '../../src/renderer/src/panels/canvas/graph-import-logic'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function makeCanvasNode(overrides: Partial<CanvasNode> & { id: string }): CanvasNode {
  return {
    type: 'note',
    position: { x: 0, y: 0 },
    size: { width: 280, height: 200 },
    content: '',
    metadata: {},
    ...overrides
  }
}

function makeArtifact(overrides: Partial<Artifact> & { id: string }): Artifact {
  return {
    title: overrides.id,
    type: 'note',
    created: '2026-01-01',
    modified: '2026-01-01',
    signal: 'untested',
    tags: [],
    connections: [],
    clusters_with: [],
    tensions_with: [],
    appears_in: [],
    concepts: [],
    body: '',
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// buildIdToPath
// ---------------------------------------------------------------------------

describe('buildIdToPath', () => {
  it('inverts fileToId mapping (path->id) to id->path', () => {
    const fileToId: Record<string, string> = {
      '/vault/note-a.md': 'n1',
      '/vault/note-b.md': 'n2',
      '/vault/deep/note-c.md': 'n3'
    }
    const result = buildIdToPath(fileToId)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('n1')).toBe('/vault/note-a.md')
    expect(result.get('n2')).toBe('/vault/note-b.md')
    expect(result.get('n3')).toBe('/vault/deep/note-c.md')
    expect(result.size).toBe(3)
  })

  it('returns empty Map for empty input', () => {
    const result = buildIdToPath({})
    expect(result.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeImportViewport
// ---------------------------------------------------------------------------

describe('computeImportViewport', () => {
  it('returns default viewport for empty nodes', () => {
    const vp = computeImportViewport([], 1000, 800)
    expect(vp).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('fits nodes with 100px padding', () => {
    const nodes: readonly CanvasNode[] = [
      makeCanvasNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 280, height: 200 } }),
      makeCanvasNode({
        id: 'b',
        position: { x: 500, y: 400 },
        size: { width: 280, height: 200 }
      })
    ]
    const vp = computeImportViewport(nodes, 1000, 800)

    // Bounding box: x=[0..780], y=[0..600] -> width=780, height=600
    // With padding: width=980, height=800
    // Scale to fit container 1000x800: scaleX=1000/980, scaleY=800/800
    // zoom = min(scaleX, scaleY, 1.0) = min(1.02, 1.0, 1.0) = 1.0
    expect(vp.zoom).toBeLessThanOrEqual(1.0)
    expect(vp.zoom).toBeGreaterThan(0)
  })

  it('never zooms past 1.0', () => {
    // Single small node in a large container
    const nodes: readonly CanvasNode[] = [
      makeCanvasNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 } })
    ]
    const vp = computeImportViewport(nodes, 2000, 1500)
    expect(vp.zoom).toBeLessThanOrEqual(1.0)
  })

  it('zooms below 1.0 when content is larger than container', () => {
    const nodes: readonly CanvasNode[] = [
      makeCanvasNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 280, height: 200 } }),
      makeCanvasNode({
        id: 'b',
        position: { x: 2000, y: 1500 },
        size: { width: 280, height: 200 }
      })
    ]
    const vp = computeImportViewport(nodes, 800, 600)

    // Bounding box: x=[0..2280], y=[0..1700] -> width=2280, height=1700
    // With padding: width=2480, height=1900
    // scaleX = 800/2480 ≈ 0.32, scaleY = 600/1900 ≈ 0.316
    expect(vp.zoom).toBeLessThan(1.0)
  })
})

// ---------------------------------------------------------------------------
// computeImportNodes - hub mode
// ---------------------------------------------------------------------------

describe('computeImportNodes - hub mode', () => {
  it('selects top HUB_COUNT most-connected nodes', () => {
    const nodes = Array.from({ length: 20 }, (_, i) =>
      makeNode({ id: `n${i}`, connectionCount: i })
    )
    const graph: KnowledgeGraph = { nodes, edges: [] }

    const result = computeImportNodes(graph, { mode: 'hub' })
    expect(result.nodes.length).toBe(HUB_COUNT)

    // Should have the 15 most-connected (ids n5..n19)
    const ids = new Set(result.nodes.map((n) => n.id))
    for (let i = 5; i < 20; i++) {
      expect(ids.has(`n${i}`)).toBe(true)
    }
  })

  it('filters out ghost nodes', () => {
    const nodes = [
      makeNode({ id: 'real1', connectionCount: 10 }),
      makeNode({ id: 'ghost:phantom', connectionCount: 100 }),
      makeNode({ id: 'real2', connectionCount: 5 })
    ]
    const graph: KnowledgeGraph = { nodes, edges: [] }

    const result = computeImportNodes(graph, { mode: 'hub' })
    const ids = result.nodes.map((n) => n.id)
    expect(ids).not.toContain('ghost:phantom')
    expect(ids).toContain('real1')
    expect(ids).toContain('real2')
  })

  it('returns empty for empty graph', () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [] }
    const result = computeImportNodes(graph, { mode: 'hub' })
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// computeImportNodes - tag mode
// ---------------------------------------------------------------------------

describe('computeImportNodes - tag mode', () => {
  it('filters nodes by tag', () => {
    const nodes = [
      makeNode({ id: 'a', tags: ['design', 'ux'] }),
      makeNode({ id: 'b', tags: ['engineering'] }),
      makeNode({ id: 'c', tags: ['design'] }),
      makeNode({ id: 'd' }) // no tags
    ]
    const graph: KnowledgeGraph = { nodes, edges: [] }

    const result = computeImportNodes(graph, { mode: 'tag', tag: 'design' })
    const ids = result.nodes.map((n) => n.id)
    expect(ids).toContain('a')
    expect(ids).toContain('c')
    expect(ids).not.toContain('b')
    expect(ids).not.toContain('d')
  })

  it('filters out ghost nodes', () => {
    const nodes = [
      makeNode({ id: 'real', tags: ['meta'] }),
      makeNode({ id: 'ghost:x', tags: ['meta'] })
    ]
    const graph: KnowledgeGraph = { nodes, edges: [] }

    const result = computeImportNodes(graph, { mode: 'tag', tag: 'meta' })
    expect(result.nodes.map((n) => n.id)).toEqual(['real'])
  })

  it('returns empty when no nodes match tag', () => {
    const nodes = [makeNode({ id: 'a', tags: ['other'] })]
    const graph: KnowledgeGraph = { nodes, edges: [] }

    const result = computeImportNodes(graph, { mode: 'tag', tag: 'nonexistent' })
    expect(result.nodes).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// computeImportNodes - neighborhood mode
// ---------------------------------------------------------------------------

describe('computeImportNodes - neighborhood mode', () => {
  it('uses BFS to find neighbors at given depth', () => {
    const nodes = [
      makeNode({ id: 'center', connectionCount: 3 }),
      makeNode({ id: 'hop1a', connectionCount: 2 }),
      makeNode({ id: 'hop1b', connectionCount: 1 }),
      makeNode({ id: 'hop2', connectionCount: 0 }),
      makeNode({ id: 'isolated', connectionCount: 0 })
    ]
    const edges: GraphEdge[] = [
      makeEdge('center', 'hop1a'),
      makeEdge('center', 'hop1b'),
      makeEdge('hop1a', 'hop2')
    ]
    const graph: KnowledgeGraph = { nodes, edges }

    // Depth 1: should get center, hop1a, hop1b
    const result1 = computeImportNodes(graph, {
      mode: 'neighborhood',
      activeNodeId: 'center',
      depth: 1
    })
    const ids1 = new Set(result1.nodes.map((n) => n.id))
    expect(ids1.has('center')).toBe(true)
    expect(ids1.has('hop1a')).toBe(true)
    expect(ids1.has('hop1b')).toBe(true)
    expect(ids1.has('hop2')).toBe(false)
    expect(ids1.has('isolated')).toBe(false)

    // Depth 2: should also get hop2
    const result2 = computeImportNodes(graph, {
      mode: 'neighborhood',
      activeNodeId: 'center',
      depth: 2
    })
    const ids2 = new Set(result2.nodes.map((n) => n.id))
    expect(ids2.has('hop2')).toBe(true)
    expect(ids2.has('isolated')).toBe(false)
  })

  it('returns empty when activeNodeId is not in graph', () => {
    const graph: KnowledgeGraph = {
      nodes: [makeNode({ id: 'a' })],
      edges: []
    }
    const result = computeImportNodes(graph, {
      mode: 'neighborhood',
      activeNodeId: 'missing',
      depth: 1
    })
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 25-cap enforcement
// ---------------------------------------------------------------------------

describe('IMPORT_CAP enforcement', () => {
  it('caps results at 25 nodes, keeping most-connected', () => {
    // Create 40 nodes with varying connectionCount
    const nodes = Array.from({ length: 40 }, (_, i) =>
      makeNode({ id: `n${i}`, connectionCount: i, tags: ['common'] })
    )
    const graph: KnowledgeGraph = { nodes, edges: [] }

    const result = computeImportNodes(graph, { mode: 'tag', tag: 'common' })
    expect(result.nodes.length).toBe(IMPORT_CAP)

    // Should keep the 25 most-connected (n15..n39)
    const ids = new Set(result.nodes.map((n) => n.id))
    for (let i = 15; i < 40; i++) {
      expect(ids.has(`n${i}`)).toBe(true)
    }
  })

  it('does not cap when under limit', () => {
    const nodes = Array.from({ length: 10 }, (_, i) =>
      makeNode({ id: `n${i}`, tags: ['ok'] })
    )
    const graph: KnowledgeGraph = { nodes, edges: [] }

    const result = computeImportNodes(graph, { mode: 'tag', tag: 'ok' })
    expect(result.nodes.length).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// Edge filtering
// ---------------------------------------------------------------------------

describe('edge filtering', () => {
  it('only includes edges between selected nodes', () => {
    const nodes = [
      makeNode({ id: 'a', connectionCount: 10 }),
      makeNode({ id: 'b', connectionCount: 9 }),
      makeNode({ id: 'c', connectionCount: 1 })
    ]
    const edges: GraphEdge[] = [
      makeEdge('a', 'b'),
      makeEdge('b', 'c'),
      makeEdge('a', 'c')
    ]
    const graph: KnowledgeGraph = { nodes, edges }

    // Hub mode with HUB_COUNT=15 will include all 3 nodes since < 15
    const result = computeImportNodes(graph, { mode: 'hub' })
    const selectedIds = new Set(result.nodes.map((n) => n.id))

    // All edges should be present since all nodes are selected
    expect(result.edges.length).toBe(3)

    for (const edge of result.edges) {
      expect(selectedIds.has(edge.source)).toBe(true)
      expect(selectedIds.has(edge.target)).toBe(true)
    }
  })

  it('excludes edges to nodes outside the selection', () => {
    // Only 'a' has the tag, so edges to 'b' should be excluded
    const nodes = [
      makeNode({ id: 'a', tags: ['special'], connectionCount: 5 }),
      makeNode({ id: 'b', tags: ['other'], connectionCount: 3 })
    ]
    const edges: GraphEdge[] = [makeEdge('a', 'b')]
    const graph: KnowledgeGraph = { nodes, edges }

    const result = computeImportNodes(graph, { mode: 'tag', tag: 'special' })
    expect(result.nodes.length).toBe(1)
    expect(result.edges.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeOriginOffset
// ---------------------------------------------------------------------------

describe('computeOriginOffset', () => {
  it('returns 0 for empty canvas', () => {
    expect(computeOriginOffset([])).toBe(0)
  })

  it('returns max right edge + 200 gap', () => {
    const nodes: readonly CanvasNode[] = [
      makeCanvasNode({
        id: 'a',
        position: { x: 100, y: 50 },
        size: { width: 280, height: 200 }
      }),
      makeCanvasNode({
        id: 'b',
        position: { x: 500, y: 100 },
        size: { width: 300, height: 200 }
      })
    ]
    // Node A right edge: 100 + 280 = 380
    // Node B right edge: 500 + 300 = 800
    // Expected: 800 + 200 = 1000
    expect(computeOriginOffset(nodes)).toBe(1000)
  })

  it('handles single node', () => {
    const nodes: readonly CanvasNode[] = [
      makeCanvasNode({
        id: 'solo',
        position: { x: 0, y: 0 },
        size: { width: 260, height: 140 }
      })
    ]
    // Right edge: 0 + 260 = 260 + 200 = 460
    expect(computeOriginOffset(nodes)).toBe(460)
  })
})

// ---------------------------------------------------------------------------
// collectUniqueTags
// ---------------------------------------------------------------------------

describe('collectUniqueTags', () => {
  it('collects unique tags sorted by frequency descending', () => {
    const artifacts: readonly Artifact[] = [
      makeArtifact({ id: 'a', tags: ['design', 'ux'] }),
      makeArtifact({ id: 'b', tags: ['design', 'engineering'] }),
      makeArtifact({ id: 'c', tags: ['design', 'ux', 'research'] }),
      makeArtifact({ id: 'd', tags: ['engineering'] })
    ]

    const result = collectUniqueTags(artifacts)

    // design: 3, ux: 2, engineering: 2, research: 1
    expect(result[0]).toEqual({ tag: 'design', count: 3 })
    expect(result.length).toBe(4)
    // design first, then ux and engineering both at 2
    expect(result[0].tag).toBe('design')
    expect(result[result.length - 1].count).toBe(1)
  })

  it('returns empty for empty input', () => {
    expect(collectUniqueTags([])).toEqual([])
  })

  it('returns empty when artifacts have no tags', () => {
    const artifacts: readonly Artifact[] = [
      makeArtifact({ id: 'a', tags: [] }),
      makeArtifact({ id: 'b', tags: [] })
    ]
    expect(collectUniqueTags(artifacts)).toEqual([])
  })

  it('deduplicates across artifacts', () => {
    const artifacts: readonly Artifact[] = [
      makeArtifact({ id: 'a', tags: ['same'] }),
      makeArtifact({ id: 'b', tags: ['same'] }),
      makeArtifact({ id: 'c', tags: ['same'] })
    ]
    const result = collectUniqueTags(artifacts)
    expect(result).toEqual([{ tag: 'same', count: 3 }])
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('exports expected values', () => {
    expect(IMPORT_CAP).toBe(25)
    expect(HUB_COUNT).toBe(15)
    expect(IMPORT_FILTERS).toEqual({
      showOrphans: true,
      showExistingOnly: true,
      searchQuery: ''
    })
  })
})
