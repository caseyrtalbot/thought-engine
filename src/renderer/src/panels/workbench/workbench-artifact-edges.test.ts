import { describe, expect, it, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store/canvas-store'
import { createCanvasNode } from '@shared/canvas-types'
import { wireArtifactEdges } from './workbench-artifact-placement'

function placeArtifact(
  id: string,
  kind: 'session' | 'pattern' | 'tension',
  connections: string[] = [],
  tensionRefs: string[] = []
) {
  const node = createCanvasNode(
    'system-artifact',
    { x: 0, y: 0 },
    {
      content: `Test ${kind}`,
      metadata: {
        artifactKind: kind,
        artifactId: id,
        status: 'active',
        filePath: `/vault/${id}.md`,
        signal: 'emerging',
        fileRefCount: 0,
        connections,
        tensionRefs
      }
    }
  )
  useCanvasStore.getState().addNode(node)
  return node
}

describe('wireArtifactEdges', () => {
  beforeEach(() => {
    useCanvasStore.getState().closeCanvas()
  })

  it('creates bidirectional connection edges when two artifacts reference each other', () => {
    const a = placeArtifact('artifact-a', 'session', ['artifact-b'])
    const b = placeArtifact('artifact-b', 'pattern', ['artifact-a'])

    const edges = wireArtifactEdges(a.id, useCanvasStore.getState())

    // Outbound: a→b, Inbound: b→a
    expect(edges).toHaveLength(2)
    expect(edges.some((e) => e.fromNode === a.id && e.toNode === b.id)).toBe(true)
    expect(edges.some((e) => e.fromNode === b.id && e.toNode === a.id)).toBe(true)
  })

  it('creates a tension edge for tension refs', () => {
    const session = placeArtifact('s-1', 'session', [], ['t-1'])
    const tension = placeArtifact('t-1', 'tension')

    const edges = wireArtifactEdges(session.id, useCanvasStore.getState())

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      fromNode: session.id,
      toNode: tension.id,
      kind: 'tension'
    })
  })

  it('creates no edges when no matching artifacts are on canvas', () => {
    const a = placeArtifact('artifact-a', 'session', ['artifact-missing'])

    const edges = wireArtifactEdges(a.id, useCanvasStore.getState())

    expect(edges).toHaveLength(0)
  })

  it('does not create duplicate same-direction same-kind edges', () => {
    const a = placeArtifact('a', 'session', ['b'], ['b'])
    placeArtifact('b', 'tension', ['a'])

    const edges = wireArtifactEdges(a.id, useCanvasStore.getState())

    // Outbound: a→b connection, a→b tension
    // Inbound: b→a connection (b references a)
    // Same-kind same-direction duplicates are deduped
    const outboundConnection = edges.filter((e) => e.fromNode === a.id && e.kind === 'connection')
    const outboundTension = edges.filter((e) => e.fromNode === a.id && e.kind === 'tension')
    const inboundConnection = edges.filter((e) => e.toNode === a.id && e.kind === 'connection')
    expect(outboundConnection).toHaveLength(1)
    expect(outboundTension).toHaveLength(1)
    expect(inboundConnection).toHaveLength(1)
    expect(edges).toHaveLength(3)
  })

  it('wires inbound edges from existing nodes that reference the new node', () => {
    // A is placed first and references B, but B doesn't reference A
    const a = placeArtifact('a', 'session', ['b'])
    const b = placeArtifact('b', 'pattern')

    // When B is placed, A's connection to B should produce an edge
    const edges = wireArtifactEdges(b.id, useCanvasStore.getState())

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      fromNode: a.id,
      toNode: b.id,
      kind: 'connection'
    })
  })

  it('wires both outbound and inbound edges for a new node', () => {
    // A references C, B references nothing
    const a = placeArtifact('a', 'session', ['c'])
    placeArtifact('b', 'pattern')
    // C references B and is referenced by A
    const c = placeArtifact('c', 'tension', ['b'])

    const edges = wireArtifactEdges(c.id, useCanvasStore.getState())

    // Outbound: c→b (connection from c's connections)
    // Inbound: a→c (a references c in its connections)
    expect(edges).toHaveLength(2)
    expect(edges.some((e) => e.fromNode === c.id && e.kind === 'connection')).toBe(true)
    expect(edges.some((e) => e.fromNode === a.id && e.toNode === c.id)).toBe(true)
  })

  it('skips inbound edges that already exist in the store', () => {
    const a = placeArtifact('a', 'session', ['b'])
    const b = placeArtifact('b', 'pattern')

    // Simulate edge already in store (e.g., from a previous wireArtifactEdges call)
    const existingEdge = {
      id: 'existing-1',
      fromNode: a.id,
      toNode: b.id,
      fromSide: 'right' as const,
      toSide: 'left' as const,
      kind: 'connection' as const
    }
    useCanvasStore.getState().addEdge(existingEdge)

    const edges = wireArtifactEdges(b.id, useCanvasStore.getState())

    // Edge already exists, should not duplicate
    expect(edges).toHaveLength(0)
  })

  it('handles node with no connections or tension refs', () => {
    const a = placeArtifact('solo', 'pattern')

    const edges = wireArtifactEdges(a.id, useCanvasStore.getState())

    expect(edges).toHaveLength(0)
  })
})
