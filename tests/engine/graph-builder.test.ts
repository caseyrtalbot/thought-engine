import { describe, it, expect } from 'vitest'
import { buildGraph } from '@engine/graph-builder'
import type { Artifact } from '@shared/types'

function makeArtifact(
  overrides: Partial<Artifact> & { id: string; title: string; type: Artifact['type'] }
): Artifact {
  return {
    created: '2026-03-12',
    modified: '2026-03-12',
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

describe('buildGraph', () => {
  it('creates nodes from artifacts', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'Gene 1', type: 'gene' }),
      makeArtifact({ id: 'c1', title: 'Constraint 1', type: 'constraint' })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes[0].id).toBe('g1')
    expect(graph.nodes[0].type).toBe('gene')
  })

  it('does not create tag nodes', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', tags: ['strategy'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes.find((n) => n.type === 'tag')).toBeUndefined()
  })

  it('does not create ghost nodes', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', concepts: ['Nonexistent'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes.find((n) => n.id.startsWith('ghost:'))).toBeUndefined()
  })

  it('creates connection edges', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', connections: ['g2'] }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene' })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toEqual({ source: 'g1', target: 'g2', kind: 'connection' })
  })

  it('creates cluster, tension, and appears_in edges', () => {
    const artifacts = [
      makeArtifact({
        id: 'g1', title: 'G1', type: 'gene',
        clusters_with: ['g2'], tensions_with: ['c1'], appears_in: ['i1']
      }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene' }),
      makeArtifact({ id: 'c1', title: 'C1', type: 'constraint' }),
      makeArtifact({ id: 'i1', title: 'Index', type: 'index' })
    ]
    const graph = buildGraph(artifacts)
    const kinds = graph.edges.map((e) => e.kind)
    expect(kinds).toContain('cluster')
    expect(kinds).toContain('tension')
    expect(kinds).toContain('appears_in')
  })

  it('deduplicates edges', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', connections: ['g2'] }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene', connections: ['g1'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(1)
  })

  it('counts connections correctly for node sizing', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', connections: ['g2', 'g3'] }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene', connections: ['g1'] }),
      makeArtifact({ id: 'g3', title: 'G3', type: 'gene' })
    ]
    const graph = buildGraph(artifacts)
    const g1 = graph.nodes.find((n) => n.id === 'g1')
    expect(g1!.connectionCount).toBe(2)
  })

  // --- Co-occurrence edge tests ---

  it('creates co-occurrence edges between files sharing a tag', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['rare-tag'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['rare-tag'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
    expect(coEdges[0].source).not.toBe(coEdges[0].target)
  })

  it('creates co-occurrence edges between files sharing a concept', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', concepts: ['strategy'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', concepts: ['strategy'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
  })

  it('deduplicates tag and concept with same word into one term', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['strategy'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', concepts: ['Strategy'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
  })

  it('does not create duplicate co-occurrence edge for same-word tag and concept in one file', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['strategy'], concepts: ['strategy'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['strategy'], concepts: ['strategy'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
  })

  it('skips co-occurrence for terms used in 20+ files', () => {
    const artifacts = Array.from({ length: 20 }, (_, i) =>
      makeArtifact({ id: `n${i}`, title: `Note ${i}`, type: 'note', tags: ['common'] })
    )
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(0)
  })

  it('does not create co-occurrence when explicit frontmatter edge exists', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', connections: ['b'], tags: ['shared'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['shared'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].kind).toBe('connection')
  })

  it('weights edges higher for rare shared terms', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['rare'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['rare'] }),
      makeArtifact({ id: 'c', title: 'C', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'd', title: 'D', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'e', title: 'E', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'f', title: 'F', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'g', title: 'G', type: 'note', tags: ['medium'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges.length).toBe(11) // 1 (rare) + 10 (medium C(5,2))
  })

  it('creates no co-occurrence edges for file with single unique tag', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['unique-a'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['unique-b'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(0)
  })
})
