import { describe, it, expect } from 'vitest'
import { buildGraph } from '@engine/graph-builder'
import type { Artifact } from '@shared/types'

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

describe('buildGraph case-insensitive bodyLinks', () => {
  it('resolves bodyLink to existing node via case-insensitive match', () => {
    const artifacts: Artifact[] = [
      makeArtifact({ id: 'Foo', bodyLinks: [] }),
      makeArtifact({ id: 'bar', bodyLinks: ['foo'] })
    ]
    const graph = buildGraph(artifacts)
    const relatedEdges = graph.edges.filter((e) => e.kind === 'related')
    expect(relatedEdges).toHaveLength(1)
    expect(relatedEdges[0].source).toBe('bar')
    expect(relatedEdges[0].target).toBe('Foo')
  })

  it('does not create phantom node when case differs', () => {
    const artifacts: Artifact[] = [
      makeArtifact({ id: 'MyNote' }),
      makeArtifact({ id: 'other', bodyLinks: ['mynote'] })
    ]
    const graph = buildGraph(artifacts)
    const nodeIds = graph.nodes.map((n) => n.id)
    expect(nodeIds).not.toContain('mynote')
    expect(nodeIds).toContain('MyNote')
  })

  it('falls back to raw link when no node matches', () => {
    const artifacts: Artifact[] = [makeArtifact({ id: 'a', bodyLinks: ['nonexistent'] })]
    const graph = buildGraph(artifacts)
    const relatedEdges = graph.edges.filter((e) => e.kind === 'related')
    expect(relatedEdges).toHaveLength(1)
    expect(relatedEdges[0].target).toBe('nonexistent')
  })

  it('[[Foo]] and [[foo]] from different artifacts both resolve to same node', () => {
    const artifacts: Artifact[] = [
      makeArtifact({ id: 'Foo' }),
      makeArtifact({ id: 'a', bodyLinks: ['foo'] }),
      makeArtifact({ id: 'b', bodyLinks: ['foo'] })
    ]
    const graph = buildGraph(artifacts)
    const relatedEdges = graph.edges.filter((e) => e.kind === 'related')
    expect(relatedEdges).toHaveLength(2)
    for (const edge of relatedEdges) {
      expect(edge.target).toBe('Foo')
    }
  })
})
