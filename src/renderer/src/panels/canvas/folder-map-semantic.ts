import {
  createCanvasEdge,
  createCanvasNode,
  type CanvasEdge,
  type CanvasNode
} from '@shared/canvas-types'
import { stableNodeId } from '@shared/engine/project-map-types'
import type { Artifact, GraphEdge, KnowledgeGraph } from '@shared/types'
import * as path from '@shared/engine/posix-path'
import { computeCardSize, computeOptimalEdgeSides } from './canvas-layout'

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx'])
const EXTERNAL_NODE_GAP_X = 96
const EXTERNAL_NODE_GAP_Y = 72
const DEFAULT_MAX_EXTERNAL_NOTES = 8

interface FolderMapSemanticInput {
  readonly rootPath: string
  readonly nodes: readonly CanvasNode[]
  readonly edges: readonly CanvasEdge[]
  readonly graph: KnowledgeGraph
  readonly artifacts: readonly Artifact[]
  readonly fileToId: Readonly<Record<string, string>>
  readonly artifactPathById: Readonly<Record<string, string>>
  readonly maxExternalNotes?: number
}

interface RankedExternalNote {
  readonly artifactId: string
  readonly weight: number
}

function isMarkdownPath(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function edgeKey(fromId: string, toId: string, kind: string, directed: boolean): string {
  if (directed) return `${fromId}->${toId}:${kind}`
  return `${[fromId, toId].sort().join('<->')}:${kind}`
}

function semanticKind(edge: GraphEdge): string {
  if (edge.kind === 'related' && edge.provenance?.source === 'wikilink') {
    return 'references'
  }
  return edge.kind
}

function externalWeight(edge: GraphEdge): number {
  switch (edge.provenance?.source) {
    case 'frontmatter':
      return 4
    case 'wikilink':
      return 3
    case 'co-occurrence':
      return 1
    default:
      return 2
  }
}

function mappedNoteSize(artifact: Artifact | undefined): { width: number; height: number } {
  return computeCardSize({
    titleLength: artifact?.title.length ?? 0,
    bodyLength: artifact?.body.length ?? 0,
    metadataCount: artifact ? Object.keys(artifact.frontmatter).length : 0
  })
}

function externalPosition(
  index: number,
  count: number,
  startX: number,
  startY: number,
  size: { width: number; height: number }
): { x: number; y: number } {
  const columns = Math.min(2, Math.max(1, Math.ceil(Math.sqrt(count))))
  const col = index % columns
  const row = Math.floor(index / columns)
  return {
    x: startX + col * (size.width + EXTERNAL_NODE_GAP_X),
    y: startY + row * (size.height + EXTERNAL_NODE_GAP_Y)
  }
}

export function augmentFolderMapWithVaultSemantics(input: FolderMapSemanticInput): {
  readonly nodes: readonly CanvasNode[]
  readonly edges: readonly CanvasEdge[]
} {
  const {
    rootPath,
    nodes,
    edges,
    graph,
    artifacts,
    fileToId,
    artifactPathById,
    maxExternalNotes = DEFAULT_MAX_EXTERNAL_NOTES
  } = input

  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]))
  const canvasNodeByArtifactId = new Map<string, CanvasNode>()

  for (const node of nodes) {
    if (node.type !== 'note' || !node.content) continue
    const artifactId = fileToId[node.content]
    if (artifactId) {
      canvasNodeByArtifactId.set(artifactId, node)
    }
  }

  if (canvasNodeByArtifactId.size === 0) {
    return { nodes, edges }
  }

  const mappedArtifactIds = new Set(canvasNodeByArtifactId.keys())
  const rankedExternalNotes = new Map<string, RankedExternalNote>()

  for (const edge of graph.edges) {
    const sourceMapped = mappedArtifactIds.has(edge.source)
    const targetMapped = mappedArtifactIds.has(edge.target)
    if (!sourceMapped && !targetMapped) continue
    if (sourceMapped && targetMapped) continue

    const externalArtifactId = sourceMapped ? edge.target : edge.source
    const externalPath = artifactPathById[externalArtifactId]
    if (
      !externalPath ||
      !isMarkdownPath(externalPath) ||
      mappedArtifactIds.has(externalArtifactId)
    ) {
      continue
    }

    const current = rankedExternalNotes.get(externalArtifactId)
    const weight = (current?.weight ?? 0) + externalWeight(edge)
    rankedExternalNotes.set(externalArtifactId, { artifactId: externalArtifactId, weight })
  }

  const externalNotes = [...rankedExternalNotes.values()]
    .sort((a, b) => b.weight - a.weight || a.artifactId.localeCompare(b.artifactId))
    .slice(0, maxExternalNotes)

  const augmentedNodes = [...nodes]
  if (externalNotes.length > 0) {
    let maxRight = -Infinity
    let minTop = Infinity
    for (const node of nodes) {
      maxRight = Math.max(maxRight, node.position.x + node.size.width)
      minTop = Math.min(minTop, node.position.y)
    }

    const startX = maxRight + 240
    const startY = Number.isFinite(minTop) ? minTop : 0

    externalNotes.forEach((external, index) => {
      const externalPath = artifactPathById[external.artifactId]
      if (!externalPath) return

      const artifact = artifactById.get(external.artifactId)
      const size = mappedNoteSize(artifact)
      const node = createCanvasNode(
        'note',
        externalPosition(index, externalNotes.length, startX, startY, size),
        {
          size,
          content: externalPath,
          metadata: {
            relativePath: externalPath.startsWith(rootPath + '/')
              ? path.relative(rootPath, externalPath)
              : externalPath,
            folderMapRoot: rootPath,
            graphNodeId: external.artifactId,
            isExternalConnection: true
          }
        }
      )

      const stableId = stableNodeId(rootPath, `semantic::${externalPath}`)
      const stableNode: CanvasNode = { ...node, id: stableId }
      augmentedNodes.push(stableNode)
      canvasNodeByArtifactId.set(external.artifactId, stableNode)
    })
  }

  const augmentedEdges = [...edges]
  const existingEdgeKeys = new Set(
    edges.map((edge) =>
      edgeKey(edge.fromNode, edge.toNode, edge.kind ?? 'connection', edge.kind === 'appears_in')
    )
  )

  for (const edge of graph.edges) {
    const fromNode = canvasNodeByArtifactId.get(edge.source)
    const toNode = canvasNodeByArtifactId.get(edge.target)
    if (!fromNode || !toNode || fromNode.id === toNode.id) continue

    const kind = semanticKind(edge)
    const key = edgeKey(fromNode.id, toNode.id, kind, kind === 'appears_in')
    if (existingEdgeKeys.has(key)) continue
    existingEdgeKeys.add(key)

    const { fromSide, toSide } = computeOptimalEdgeSides(fromNode, toNode)
    const canvasEdge = createCanvasEdge(fromNode.id, toNode.id, fromSide, toSide)
    augmentedEdges.push({ ...canvasEdge, kind })
  }

  return { nodes: augmentedNodes, edges: augmentedEdges }
}
