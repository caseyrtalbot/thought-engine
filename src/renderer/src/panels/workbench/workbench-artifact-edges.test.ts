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

  it('creates a connection edge when two artifacts share a connection', () => {
    const a = placeArtifact('artifact-a', 'session', ['artifact-b'])
    const b = placeArtifact('artifact-b', 'pattern', ['artifact-a'])

    const edges = wireArtifactEdges(a.id, useCanvasStore.getState())

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      fromNode: a.id,
      kind: 'connection'
    })
    // The edge connects to the node whose artifactId matches
    expect(edges[0].toNode).toBe(b.id)
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

  it('does not create duplicate edges', () => {
    const a = placeArtifact('a', 'session', ['b'], ['b'])
    placeArtifact('b', 'tension', ['a'])

    const edges = wireArtifactEdges(a.id, useCanvasStore.getState())

    // a→b via connection and a→b via tension should both exist (different kinds)
    // but same-kind duplicates should be deduped
    const connectionEdges = edges.filter((e) => e.kind === 'connection')
    const tensionEdges = edges.filter((e) => e.kind === 'tension')
    expect(connectionEdges).toHaveLength(1)
    expect(tensionEdges).toHaveLength(1)
  })

  it('handles node with no connections or tension refs', () => {
    const a = placeArtifact('solo', 'pattern')

    const edges = wireArtifactEdges(a.id, useCanvasStore.getState())

    expect(edges).toHaveLength(0)
  })
})
