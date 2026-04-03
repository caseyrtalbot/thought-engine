import type { CanvasNode, CanvasEdge, CanvasViewport } from '@shared/canvas-types'
import type {
  AgentActionName,
  AgentContext,
  AgentCardContext,
  AgentNeighborContext,
  AgentEdgeContext
} from '@shared/agent-action-types'
import type { TagTreeNode } from '@shared/engine/tag-index'
import type { GhostEntry } from '@shared/engine/ghost-index'

/**
 * Pure function: extracts agent context from canvas state.
 * Caller passes data -- no store access here (keeps it testable).
 */
export function extractAgentContext(
  action: AgentActionName,
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  selectedIds: ReadonlySet<string>,
  viewport: CanvasViewport,
  containerSize: { width: number; height: number }
): AgentContext {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // For tidy with no selection, use all nodes
  const effectiveSelectedIds =
    selectedIds.size === 0 ? new Set(nodes.map((n) => n.id)) : selectedIds

  // Selected cards: full content
  const selectedCards: AgentCardContext[] = []
  for (const id of effectiveSelectedIds) {
    const node = nodeMap.get(id)
    if (!node) continue
    selectedCards.push({
      id: node.id,
      type: node.type,
      title: extractTitle(node),
      body: node.content,
      tags: extractTags(node),
      position: { x: node.position.x, y: node.position.y },
      size: { width: node.size.width, height: node.size.height }
    })
  }

  // 1-hop neighbors: cards connected by an edge to any selected card
  const neighborIds = new Set<string>()
  for (const edge of edges) {
    if (effectiveSelectedIds.has(edge.fromNode) && !effectiveSelectedIds.has(edge.toNode)) {
      neighborIds.add(edge.toNode)
    }
    if (effectiveSelectedIds.has(edge.toNode) && !effectiveSelectedIds.has(edge.fromNode)) {
      neighborIds.add(edge.fromNode)
    }
  }

  const neighbors: AgentNeighborContext[] = []
  for (const id of neighborIds) {
    const node = nodeMap.get(id)
    if (!node) continue
    // Find the edge kind connecting this neighbor to a selected card
    const connectingEdge = edges.find(
      (e) =>
        (e.fromNode === id && effectiveSelectedIds.has(e.toNode)) ||
        (e.toNode === id && effectiveSelectedIds.has(e.fromNode))
    )
    neighbors.push({
      id: node.id,
      title: extractTitle(node),
      tags: extractTags(node),
      edgeKind: connectingEdge?.kind ?? 'connection'
    })
  }

  // Edges between all included cards (selected + neighbors)
  const includedIds = new Set([...effectiveSelectedIds, ...neighborIds])
  const includedEdges: AgentEdgeContext[] = edges
    .filter((e) => includedIds.has(e.fromNode) && includedIds.has(e.toNode))
    .map((e) => ({
      id: e.id,
      fromNode: e.fromNode,
      toNode: e.toNode,
      kind: e.kind ?? undefined,
      label: e.label ?? undefined
    }))

  // Viewport bounds in canvas space
  const viewportBounds = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: containerSize.width / viewport.zoom,
    height: containerSize.height / viewport.zoom
  }

  return {
    action,
    selectedCards,
    neighbors,
    edges: includedEdges,
    canvasMeta: {
      viewportBounds,
      totalCardCount: nodes.length
    }
  }
}

function extractTitle(node: CanvasNode): string {
  // For note cards, content is a file path -- use the filename stem
  if (node.type === 'note') {
    const parts = node.content.split('/')
    const filename = parts[parts.length - 1] ?? node.content
    return filename.replace(/\.md$/, '')
  }
  // For text cards, first line or truncated content
  const firstLine = node.content.split('\n')[0] ?? ''
  return firstLine.slice(0, 100)
}

function extractTags(node: CanvasNode): readonly string[] {
  const tags = node.metadata?.tags
  if (Array.isArray(tags)) return tags as string[]
  return []
}

// ---------------------------------------------------------------------------
// Vault-scope context (no card selection)
// ---------------------------------------------------------------------------

export interface ArtifactSummary {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly signal: string
  readonly tags: readonly string[]
  readonly origin: string
}

/**
 * Build agent context from vault-wide summaries (no card selection).
 * Used for vault-scope /challenge and /emerge.
 */
export function buildVaultScopeContext(
  action: AgentActionName,
  artifacts: readonly ArtifactSummary[],
  tagTree: readonly TagTreeNode[],
  ghosts: readonly GhostEntry[],
  canvasMeta: {
    viewportBounds: { x: number; y: number; width: number; height: number }
    totalCardCount: number
  }
): AgentContext {
  const selectedCards: AgentCardContext[] = artifacts.map((a, i) => ({
    id: a.id,
    type: 'text' as const,
    title: a.title,
    body: `[${a.type}] ${a.title} (signal: ${a.signal}, origin: ${a.origin}, tags: ${a.tags.join(', ') || 'none'})`,
    tags: a.tags,
    position: { x: 0, y: i * 20 },
    size: { width: 200, height: 40 }
  }))

  const tagSummary = tagTree.map((t) => `${t.fullPath} (${t.count})`).join(', ')

  const ghostSummary = ghosts
    .slice(0, 20)
    .map((g) => `${g.id} (${g.referenceCount} refs)`)
    .join(', ')

  const neighbors: AgentNeighborContext[] = [
    ...(tagSummary
      ? [
          {
            id: '_tag_tree',
            title: `Tag Tree: ${tagSummary}`,
            tags: [] as readonly string[],
            edgeKind: 'metadata'
          }
        ]
      : []),
    ...(ghostSummary
      ? [
          {
            id: '_ghost_index',
            title: `Unresolved References: ${ghostSummary}`,
            tags: [] as readonly string[],
            edgeKind: 'metadata'
          }
        ]
      : [])
  ]

  return {
    action,
    vaultScope: true,
    selectedCards,
    neighbors,
    edges: [],
    canvasMeta
  }
}
