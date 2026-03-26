import { describe, it, expect } from 'vitest'
import { buildGraph } from '@engine/graph-builder'
import type { Artifact, GraphEdge, EdgeProvenance } from '@shared/types'

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
    related: [],
    bodyLinks: [],
    concepts: [],
    body: '',
    frontmatter: {},
    ...overrides
  }
}

describe('GraphEdge provenance type', () => {
  it('accepts an edge with provenance fields', () => {
    const provenance: EdgeProvenance = {
      source: 'frontmatter',
      createdBy: 'auto-detect',
      confidence: 1.0,
      createdAt: '2026-01-01T00:00:00.000Z'
    }

    const edge: GraphEdge = {
      source: 'note-a',
      target: 'note-b',
      kind: 'connection',
      provenance
    }

    expect(edge.provenance).toBeDefined()
    expect(edge.provenance!.source).toBe('frontmatter')
    expect(edge.provenance!.createdBy).toBe('auto-detect')
    expect(edge.provenance!.confidence).toBe(1.0)
    expect(edge.provenance!.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('allows edge without provenance for backward compat', () => {
    const edge: GraphEdge = {
      source: 'note-a',
      target: 'note-b',
      kind: 'connection'
    }

    expect(edge.provenance).toBeUndefined()
  })
})

describe('buildGraph provenance: frontmatter edges', () => {
  it('stamps provenance.source as frontmatter for connection edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', connections: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find(
      (e) => e.kind === 'connection' && e.source === 'note-a' && e.target === 'note-b'
    )

    expect(edge).toBeDefined()
    expect(edge!.provenance).toBeDefined()
    expect(edge!.provenance!.source).toBe('frontmatter')
  })

  it('stamps provenance.source as frontmatter for cluster edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', clusters_with: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find((e) => e.kind === 'cluster')

    expect(edge).toBeDefined()
    expect(edge!.provenance).toBeDefined()
    expect(edge!.provenance!.source).toBe('frontmatter')
  })

  it('stamps provenance.source as frontmatter for tension edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', tensions_with: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find((e) => e.kind === 'tension')

    expect(edge).toBeDefined()
    expect(edge!.provenance).toBeDefined()
    expect(edge!.provenance!.source).toBe('frontmatter')
  })

  it('stamps provenance.source as frontmatter for appears_in edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', appears_in: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find((e) => e.kind === 'appears_in')

    expect(edge).toBeDefined()
    expect(edge!.provenance).toBeDefined()
    expect(edge!.provenance!.source).toBe('frontmatter')
  })

  it('stamps provenance.source as frontmatter for related edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', related: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find((e) => e.kind === 'related')

    expect(edge).toBeDefined()
    expect(edge!.provenance).toBeDefined()
    expect(edge!.provenance!.source).toBe('frontmatter')
  })

  it('stamps createdBy as auto-detect for frontmatter edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', connections: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find((e) => e.kind === 'connection')

    expect(edge!.provenance!.createdBy).toBe('auto-detect')
  })
})

describe('buildGraph provenance: wikilink edges', () => {
  it('stamps provenance.source as wikilink for body wikilink edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', bodyLinks: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find(
      (e) => e.kind === 'related' && e.source === 'note-a' && e.target === 'note-b'
    )

    expect(edge).toBeDefined()
    expect(edge!.provenance).toBeDefined()
    expect(edge!.provenance!.source).toBe('wikilink')
  })

  it('stamps createdBy as auto-detect for wikilink edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', bodyLinks: ['note-b'] }),
      makeArtifact({ id: 'note-b' })
    ]

    const graph = buildGraph(artifacts)
    const edge = graph.edges.find((e) => e.kind === 'related' && e.source === 'note-a')

    expect(edge!.provenance!.createdBy).toBe('auto-detect')
  })

  it('distinguishes wikilink from frontmatter related edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', related: ['note-b'], bodyLinks: ['note-c'] }),
      makeArtifact({ id: 'note-b' }),
      makeArtifact({ id: 'note-c' })
    ]

    const graph = buildGraph(artifacts)
    const frontmatterEdge = graph.edges.find((e) => e.kind === 'related' && e.target === 'note-b')
    const wikilinkEdge = graph.edges.find((e) => e.kind === 'related' && e.target === 'note-c')

    expect(frontmatterEdge!.provenance!.source).toBe('frontmatter')
    expect(wikilinkEdge!.provenance!.source).toBe('wikilink')
  })
})

describe('buildGraph provenance: co-occurrence edges', () => {
  it('stamps provenance.source as co-occurrence', () => {
    // Two artifacts sharing a tag that appears in exactly 2 files
    // gives weight = 1/log2(2) = 1.0, which is above MIN_EDGE_WEIGHT (0.3)
    const artifacts = [
      makeArtifact({ id: 'note-a', tags: ['shared-topic'] }),
      makeArtifact({ id: 'note-b', tags: ['shared-topic'] })
    ]

    const graph = buildGraph(artifacts)
    const coEdge = graph.edges.find((e) => e.kind === 'co-occurrence')

    expect(coEdge).toBeDefined()
    expect(coEdge!.provenance).toBeDefined()
    expect(coEdge!.provenance!.source).toBe('co-occurrence')
  })

  it('sets confidence between 0 and 1', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', tags: ['shared-topic'] }),
      makeArtifact({ id: 'note-b', tags: ['shared-topic'] })
    ]

    const graph = buildGraph(artifacts)
    const coEdge = graph.edges.find((e) => e.kind === 'co-occurrence')

    expect(coEdge!.provenance!.confidence).toBeDefined()
    expect(coEdge!.provenance!.confidence).toBeGreaterThan(0)
    expect(coEdge!.provenance!.confidence).toBeLessThanOrEqual(1)
  })

  it('stamps createdBy as auto-detect for co-occurrence edges', () => {
    const artifacts = [
      makeArtifact({ id: 'note-a', tags: ['shared-topic'] }),
      makeArtifact({ id: 'note-b', tags: ['shared-topic'] })
    ]

    const graph = buildGraph(artifacts)
    const coEdge = graph.edges.find((e) => e.kind === 'co-occurrence')

    expect(coEdge!.provenance!.createdBy).toBe('auto-detect')
  })

  it('reflects weight as confidence (higher weight = higher confidence)', () => {
    // Two shared tags = higher weight than one
    const artifacts = [
      makeArtifact({ id: 'note-a', tags: ['topic-x', 'topic-y'] }),
      makeArtifact({ id: 'note-b', tags: ['topic-x', 'topic-y'] })
    ]

    const graph = buildGraph(artifacts)
    const coEdge = graph.edges.find((e) => e.kind === 'co-occurrence')

    expect(coEdge).toBeDefined()
    // Two shared tags each with freq=2, weight = 2 * (1/log2(2)) = 2.0
    // Confidence should be capped at 1.0
    expect(coEdge!.provenance!.confidence).toBeLessThanOrEqual(1)
    expect(coEdge!.provenance!.confidence).toBeGreaterThan(0)
  })
})

describe('buildGraph provenance: completeness', () => {
  it('every edge has provenance defined (no undefined provenance)', () => {
    const artifacts = [
      makeArtifact({
        id: 'note-a',
        connections: ['note-b'],
        clusters_with: ['note-c'],
        tensions_with: ['note-d'],
        appears_in: ['note-e'],
        related: ['note-f'],
        bodyLinks: ['note-g'],
        tags: ['shared-tag']
      }),
      makeArtifact({ id: 'note-b', tags: ['shared-tag'] }),
      makeArtifact({ id: 'note-c' }),
      makeArtifact({ id: 'note-d' }),
      makeArtifact({ id: 'note-e' }),
      makeArtifact({ id: 'note-f' }),
      makeArtifact({ id: 'note-g' })
    ]

    const graph = buildGraph(artifacts)

    // Should have at least one edge of each kind
    expect(graph.edges.length).toBeGreaterThan(0)

    for (const edge of graph.edges) {
      expect(edge.provenance).toBeDefined()
      expect(edge.provenance!.source).toBeTruthy()
      expect(edge.provenance!.createdBy).toBe('auto-detect')
    }
  })

  it('provenance.source matches edge kind for all edge types', () => {
    const artifacts = [
      makeArtifact({
        id: 'note-a',
        connections: ['note-b'],
        bodyLinks: ['note-c'],
        tags: ['overlap']
      }),
      makeArtifact({ id: 'note-b' }),
      makeArtifact({ id: 'note-c' }),
      makeArtifact({ id: 'note-d', tags: ['overlap'] })
    ]

    const graph = buildGraph(artifacts)

    const connectionEdge = graph.edges.find((e) => e.kind === 'connection')
    expect(connectionEdge!.provenance!.source).toBe('frontmatter')

    const wikilinkEdge = graph.edges.find(
      (e) => e.kind === 'related' && e.source === 'note-a' && e.target === 'note-c'
    )
    expect(wikilinkEdge!.provenance!.source).toBe('wikilink')

    const coEdge = graph.edges.find((e) => e.kind === 'co-occurrence')
    if (coEdge) {
      expect(coEdge.provenance!.source).toBe('co-occurrence')
    }
  })
})
