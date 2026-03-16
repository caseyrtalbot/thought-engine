import type { KnowledgeGraph, GraphNode, GraphEdge, Artifact } from '@shared/types'
import type { CanvasNode, CanvasViewport } from '@shared/canvas-types'
import type { GraphFilters } from '../graph/graph-model'
import { buildLocalGraphModel } from '../graph/graph-model'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const IMPORT_CAP = 25
export const HUB_COUNT = 15

export const IMPORT_FILTERS: GraphFilters = {
  showOrphans: true,
  showExistingOnly: true,
  searchQuery: ''
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagInfo {
  readonly tag: string
  readonly count: number
}

export type ImportMode =
  | { mode: 'neighborhood'; activeNodeId: string; depth: number }
  | { mode: 'hub' }
  | { mode: 'tag'; tag: string }

// ---------------------------------------------------------------------------
// buildIdToPath
// ---------------------------------------------------------------------------

/**
 * Inverts the vault store's fileToId (path -> id) to id -> path.
 * Returns a new Map (no mutation).
 */
export function buildIdToPath(fileToId: Record<string, string>): Map<string, string> {
  const result = new Map<string, string>()
  for (const [path, id] of Object.entries(fileToId)) {
    result.set(id, path)
  }
  return result
}

// ---------------------------------------------------------------------------
// computeImportViewport
// ---------------------------------------------------------------------------

/**
 * Computes a viewport that fits imported nodes with 100px padding.
 * Returns default viewport for empty input. Never zooms past 1.0.
 */
export function computeImportViewport(
  nodes: readonly CanvasNode[],
  containerWidth: number,
  containerHeight: number
): CanvasViewport {
  if (nodes.length === 0) {
    return { x: 0, y: 0, zoom: 1 }
  }

  const padding = 100

  // Compute bounding box of all nodes
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const left = node.position.x
    const top = node.position.y
    const right = left + node.size.width
    const bottom = top + node.size.height

    if (left < minX) minX = left
    if (top < minY) minY = top
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }

  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2

  const scaleX = containerWidth / contentWidth
  const scaleY = containerHeight / contentHeight
  const zoom = Math.min(scaleX, scaleY, 1.0)

  // Center the content in the viewport
  const cx = minX + (maxX - minX) / 2
  const cy = minY + (maxY - minY) / 2
  const x = containerWidth / 2 / zoom - cx
  const y = containerHeight / 2 / zoom - cy

  return { x, y, zoom }
}

// ---------------------------------------------------------------------------
// computeImportNodes
// ---------------------------------------------------------------------------

function isGhost(node: GraphNode): boolean {
  return node.id.startsWith('ghost:')
}

/**
 * Apply the 25-node cap, keeping the most-connected nodes.
 * Returns a new sorted array (no mutation).
 */
function applyCap(nodes: readonly GraphNode[]): readonly GraphNode[] {
  if (nodes.length <= IMPORT_CAP) return nodes
  const sorted = [...nodes].sort((a, b) => b.connectionCount - a.connectionCount)
  return sorted.slice(0, IMPORT_CAP)
}

/**
 * Filter edges to only those between selected nodes.
 * Returns a new array (no mutation).
 */
function filterEdges(
  edges: readonly GraphEdge[],
  selectedIds: ReadonlySet<string>
): readonly GraphEdge[] {
  return edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
}

/**
 * Compute nodes and edges for import based on the selected mode.
 * All modes filter ghost nodes and apply a 25-node cap.
 */
export function computeImportNodes(
  graph: KnowledgeGraph,
  mode: ImportMode
): { readonly nodes: readonly GraphNode[]; readonly edges: readonly GraphEdge[] } {
  let candidates: readonly GraphNode[]
  let sourceEdges: readonly GraphEdge[] = graph.edges

  switch (mode.mode) {
    case 'neighborhood': {
      const local = buildLocalGraphModel(graph, mode.activeNodeId, mode.depth, IMPORT_FILTERS)
      candidates = local.nodes
      sourceEdges = local.edges
      break
    }

    case 'hub': {
      const nonGhost = graph.nodes.filter((n) => !isGhost(n))
      const sorted = [...nonGhost].sort((a, b) => b.connectionCount - a.connectionCount)
      candidates = sorted.slice(0, HUB_COUNT)
      break
    }

    case 'tag': {
      candidates = graph.nodes.filter(
        (n) => !isGhost(n) && n.tags != null && n.tags.includes(mode.tag)
      )
      break
    }
  }

  const capped = applyCap(candidates)
  const selectedIds = new Set(capped.map((n) => n.id))
  const edges = filterEdges(sourceEdges, selectedIds)

  return { nodes: capped, edges }
}

// ---------------------------------------------------------------------------
// computeOriginOffset
// ---------------------------------------------------------------------------

/**
 * Compute the x-offset for placing imported nodes to the right of existing ones.
 * Returns 0 for empty canvas. Otherwise max right edge + 200px gap.
 */
export function computeOriginOffset(existingNodes: readonly CanvasNode[]): number {
  if (existingNodes.length === 0) return 0

  let maxRight = -Infinity
  for (const node of existingNodes) {
    const right = node.position.x + node.size.width
    if (right > maxRight) maxRight = right
  }

  return maxRight + 200
}

// ---------------------------------------------------------------------------
// collectUniqueTags
// ---------------------------------------------------------------------------

/**
 * Collect unique tags from artifacts, sorted by frequency descending.
 * Returns a new array (no mutation of inputs).
 */
export function collectUniqueTags(artifacts: readonly Artifact[]): readonly TagInfo[] {
  const counts = new Map<string, number>()

  for (const artifact of artifacts) {
    for (const tag of artifact.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  const result: TagInfo[] = []
  for (const [tag, count] of counts) {
    result.push({ tag, count })
  }

  return result.sort((a, b) => b.count - a.count)
}
