import type { KnowledgeGraph, GraphNode, GraphEdge } from '@shared/types'
import type { CanvasNode, CanvasEdge } from '@shared/canvas-types'
import { createCanvasNode, createCanvasEdge } from '@shared/canvas-types'

/** Spacing between nodes in the grid layout (px). */
const GRID_SPACING_X = 360
const GRID_SPACING_Y = 280

/** Default card size for graph-imported notes. */
const CARD_SIZE = { width: 280, height: 200 }

export interface GraphToCanvasResult {
  readonly nodes: readonly CanvasNode[]
  readonly edges: readonly CanvasEdge[]
}

/**
 * Compute the number of columns for a grid layout.
 * Uses ceil(sqrt(n)) so the grid stays roughly square.
 */
function gridColumns(nodeCount: number): number {
  if (nodeCount <= 0) return 0
  return Math.ceil(Math.sqrt(nodeCount))
}

/**
 * Convert a graph node index to a grid position.
 * Returns a fresh position object (no mutation).
 */
function gridPosition(index: number, columns: number): { x: number; y: number } {
  const col = index % columns
  const row = Math.floor(index / columns)
  return { x: col * GRID_SPACING_X, y: row * GRID_SPACING_Y }
}

/**
 * Pure function: project a KnowledgeGraph into canvas nodes and edges.
 *
 * Each GraphNode becomes a 'note' type CanvasNode laid out on a grid.
 * Each GraphEdge becomes a CanvasEdge connecting the corresponding canvas nodes.
 * Returns new arrays (no mutation of the input graph).
 *
 * @param idToPath - Maps artifact IDs to vault file paths. NoteCard uses
 *   node.content as the file path for loading, so this mapping is required
 *   for notes to render their content.
 */
export function graphToCanvas(
  graph: KnowledgeGraph,
  idToPath: ReadonlyMap<string, string>,
  origin?: { x: number; y: number }
): GraphToCanvasResult {
  if (graph.nodes.length === 0) {
    return { nodes: [], edges: [] }
  }

  const columns = gridColumns(graph.nodes.length)
  const ox = origin?.x ?? 0
  const oy = origin?.y ?? 0

  // Map graph node IDs to generated canvas node IDs for edge wiring
  const graphIdToCanvasId = new Map<string, string>()

  const canvasNodes: CanvasNode[] = graph.nodes.map((gNode: GraphNode, index: number) => {
    const grid = gridPosition(index, columns)
    const position = { x: grid.x + ox, y: grid.y + oy }
    const filePath = idToPath.get(gNode.id) ?? ''
    const cNode = createCanvasNode('note', position, {
      size: { ...CARD_SIZE },
      content: filePath,
      metadata: {
        graphNodeId: gNode.id,
        artifactType: gNode.type,
        signal: gNode.signal
      }
    })
    graphIdToCanvasId.set(gNode.id, cNode.id)
    return cNode
  })

  const canvasEdges: CanvasEdge[] = graph.edges.reduce((acc: CanvasEdge[], gEdge: GraphEdge) => {
    const fromId = graphIdToCanvasId.get(gEdge.source)
    const toId = graphIdToCanvasId.get(gEdge.target)
    // Only create edges where both endpoints exist on canvas
    if (fromId && toId) {
      return [...acc, createCanvasEdge(fromId, toId, 'right', 'left')]
    }
    return acc
  }, [])

  return { nodes: canvasNodes, edges: canvasEdges }
}

export default graphToCanvas
