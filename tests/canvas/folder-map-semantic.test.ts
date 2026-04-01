import { describe, expect, it } from 'vitest'
import type { Artifact, KnowledgeGraph } from '@shared/types'
import type { CanvasEdge, CanvasNode } from '@shared/canvas-types'
import { augmentFolderMapWithVaultSemantics } from '../../src/renderer/src/panels/canvas/folder-map-semantic'

function makeNoteNode(id: string, path: string, x: number): CanvasNode {
  return {
    id,
    type: 'note',
    position: { x, y: 0 },
    size: { width: 380, height: 260 },
    content: path,
    metadata: {}
  }
}

function makeArtifact(id: string, title: string, body: string): Artifact {
  return {
    id,
    title,
    type: 'note',
    created: '2026-03-31',
    modified: '2026-03-31',
    signal: 'untested',
    tags: [],
    connections: [],
    clusters_with: [],
    tensions_with: [],
    appears_in: [],
    related: [],
    concepts: [],
    bodyLinks: [],
    body,
    frontmatter: {}
  }
}

describe('augmentFolderMapWithVaultSemantics', () => {
  it('adds semantic edges between mapped markdown notes and connected vault notes', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'root',
        type: 'project-folder',
        position: { x: 0, y: 0 },
        size: { width: 260, height: 80 },
        content: '',
        metadata: { relativePath: '.', rootPath: '/vault/Clippings' }
      },
      makeNoteNode('note-a', '/vault/Clippings/a.md', 0),
      makeNoteNode('note-b', '/vault/Clippings/b.md', 460)
    ]

    const graph: KnowledgeGraph = {
      nodes: [],
      edges: [
        {
          source: 'a',
          target: 'b',
          kind: 'related',
          provenance: { source: 'wikilink', createdBy: 'auto-detect' }
        },
        {
          source: 'a',
          target: 'c',
          kind: 'co-occurrence',
          provenance: { source: 'co-occurrence', createdBy: 'auto-detect', confidence: 0.7 }
        }
      ]
    }

    const artifacts = [
      makeArtifact('a', 'A', '# A\n\nAlpha'),
      makeArtifact('b', 'B', '# B\n\nBeta'),
      makeArtifact('c', 'C', '# C\n\nCross-folder')
    ]

    const result = augmentFolderMapWithVaultSemantics({
      rootPath: '/vault/Clippings',
      nodes,
      edges: [] satisfies CanvasEdge[],
      graph,
      artifacts,
      fileToId: {
        '/vault/Clippings/a.md': 'a',
        '/vault/Clippings/b.md': 'b'
      },
      artifactPathById: {
        a: '/vault/Clippings/a.md',
        b: '/vault/Clippings/b.md',
        c: '/vault/Elsewhere/c.md'
      }
    })

    expect(result.nodes).toHaveLength(4)
    const externalNote = result.nodes.find((node) => node.content === '/vault/Elsewhere/c.md')
    expect(externalNote?.type).toBe('note')
    expect(externalNote?.metadata.isExternalConnection).toBe(true)

    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromNode: 'note-a',
          toNode: 'note-b',
          kind: 'references'
        }),
        expect.objectContaining({
          fromNode: 'note-a',
          toNode: externalNote?.id,
          kind: 'co-occurrence'
        })
      ])
    )
  })

  it('returns the original mapped result when no note artifacts are available', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'folder',
        type: 'project-folder',
        position: { x: 0, y: 0 },
        size: { width: 260, height: 80 },
        content: '',
        metadata: {}
      }
    ]

    const result = augmentFolderMapWithVaultSemantics({
      rootPath: '/vault',
      nodes,
      edges: [],
      graph: { nodes: [], edges: [] },
      artifacts: [],
      fileToId: {},
      artifactPathById: {}
    })

    expect(result.nodes).toEqual(nodes)
    expect(result.edges).toEqual([])
  })
})
