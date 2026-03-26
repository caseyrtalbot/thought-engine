// ---------------------------------------------------------------------------
// Agent card placement — pure function, no side effects
// ---------------------------------------------------------------------------

import type { CanvasNode } from '@shared/canvas-types'
import { getDefaultSize } from '@shared/canvas-types'

export interface PlacementViewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
  readonly width: number
  readonly height: number
}

/** Gap between placed cards, matches existing canvas conventions. */
export const PLACEMENT_GAP = 40

/** Maximum downward shifts before giving up (prevents infinite loops). */
const MAX_SHIFT_ATTEMPTS = 50

/**
 * AABB overlap check: do two axis-aligned rectangles overlap?
 * Touching edges (exactly adjacent) are NOT considered overlapping.
 */
export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Find the first node that overlaps the proposed rect.
 * Returns the colliding node, or undefined if no collision.
 */
function findCollision(
  proposed: { x: number; y: number; w: number; h: number },
  nodes: readonly CanvasNode[],
  excludeId?: string
): CanvasNode | undefined {
  return nodes.find((n) => {
    if (n.id === excludeId) return false
    const rect = {
      x: n.position.x,
      y: n.position.y,
      w: n.size.width,
      h: n.size.height
    }
    return rectsOverlap(proposed, rect)
  })
}

/**
 * Compute where to place a new agent card on the canvas.
 *
 * - If sourceNodeId is set and the node exists, places to the right of it
 *   (with collision avoidance by shifting down).
 * - Otherwise, places at viewport center.
 */
export function computeAgentPlacement(
  sourceNodeId: string | undefined,
  nodes: readonly CanvasNode[],
  viewport: PlacementViewport
): { x: number; y: number } {
  if (sourceNodeId) {
    const source = nodes.find((n) => n.id === sourceNodeId)
    if (source) {
      const newSize = getDefaultSize('agent-session')
      const x = source.position.x + source.size.width + PLACEMENT_GAP
      let y = source.position.y

      for (let attempt = 0; attempt < MAX_SHIFT_ATTEMPTS; attempt++) {
        const proposed = { x, y, w: newSize.width, h: newSize.height }
        const collision = findCollision(proposed, nodes, source.id)
        if (!collision) break
        y = collision.position.y + collision.size.height + PLACEMENT_GAP
      }

      return { x, y }
    }
  }

  return {
    x: viewport.x + viewport.width / (2 * viewport.zoom),
    y: viewport.y + viewport.height / (2 * viewport.zoom)
  }
}
