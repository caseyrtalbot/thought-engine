import { forceSimulation, forceManyBody, forceCollide, forceRadial } from 'd3-force'
import { getDefaultSize, getMinSize, type CanvasNode, type CanvasSide } from '@shared/canvas-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentMetrics {
  readonly titleLength: number
  readonly bodyLength: number
  readonly metadataCount: number
}

interface NodeRect {
  readonly position: { readonly x: number; readonly y: number }
  readonly size: { readonly width: number; readonly height: number }
}

interface ForceLayoutNode {
  readonly id: string
  readonly size: { readonly width: number; readonly height: number }
}

interface ForceLayoutInput {
  readonly sourceNode: CanvasNode
  readonly newNodes: readonly ForceLayoutNode[]
  readonly existingNodes: readonly CanvasNode[]
}

interface ForceLayoutResult {
  readonly positions: ReadonlyMap<string, { x: number; y: number }>
}

// ---------------------------------------------------------------------------
// D3 simulation node (mutable, internal only)
// ---------------------------------------------------------------------------

interface SimNode {
  index: number
  x: number
  y: number
  vx: number
  vy: number
  fx: number | null
  fy: number | null
  id: string
  radius: number
}

// ---------------------------------------------------------------------------
// 1. Content-adaptive card sizing
// ---------------------------------------------------------------------------

const NOTE_BASE_WIDTH = 380
const NOTE_WIDE_TITLE_THRESHOLD = 30
const NOTE_WIDE_TITLE_WIDTH = 420
const NOTE_RICH_META_THRESHOLD = 4
const NOTE_RICH_META_WIDTH = 420
const NOTE_BASE_HEIGHT = 260
const NOTE_ROW_HEIGHT = 24
const NOTE_BODY_CHARS_PER_PX = 4

export function computeCardSize(metrics: ContentMetrics): { width: number; height: number } {
  const defaultSize = getDefaultSize('note')
  const minSize = getMinSize('note')

  // Width: expand for long titles or many metadata fields
  let width = NOTE_BASE_WIDTH
  if (metrics.titleLength > NOTE_WIDE_TITLE_THRESHOLD) {
    width = NOTE_WIDE_TITLE_WIDTH
  }
  if (metrics.metadataCount > NOTE_RICH_META_THRESHOLD) {
    width = Math.max(width, NOTE_RICH_META_WIDTH)
  }
  width = Math.min(width, defaultSize.width)

  // Height: base + metadata rows + body estimate
  let height = NOTE_BASE_HEIGHT
  height += metrics.metadataCount * NOTE_ROW_HEIGHT
  height += Math.floor(metrics.bodyLength / NOTE_BODY_CHARS_PER_PX)
  height = Math.max(height, minSize.height)
  height = Math.min(height, defaultSize.height)

  return { width, height }
}

// ---------------------------------------------------------------------------
// 2. Optimal edge side computation
// ---------------------------------------------------------------------------

export function computeOptimalEdgeSides(
  fromNode: NodeRect,
  toNode: NodeRect
): { fromSide: CanvasSide; toSide: CanvasSide } {
  const fromCx = fromNode.position.x + fromNode.size.width / 2
  const fromCy = fromNode.position.y + fromNode.size.height / 2
  const toCx = toNode.position.x + toNode.size.width / 2
  const toCy = toNode.position.y + toNode.size.height / 2

  const dx = toCx - fromCx
  const dy = toCy - fromCy

  // Use dominant axis to pick sides
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant
    return dx >= 0 ? { fromSide: 'right', toSide: 'left' } : { fromSide: 'left', toSide: 'right' }
  } else {
    // Vertical dominant
    return dy >= 0 ? { fromSide: 'bottom', toSide: 'top' } : { fromSide: 'top', toSide: 'bottom' }
  }
}

// ---------------------------------------------------------------------------
// 3. Force-directed placement for show-connections
// ---------------------------------------------------------------------------

const MIN_RADIAL_DISTANCE = 450
const RADIAL_DISTANCE_PER_NODE = 40
const COLLISION_PADDING = 30
const REPEL_STRENGTH = -200
const RADIAL_STRENGTH = 0.3
const MAX_TICKS = 300

function boundingRadius(size: { width: number; height: number }): number {
  return Math.sqrt(size.width * size.width + size.height * size.height) / 2
}

export function computeForceLayout(input: ForceLayoutInput): ForceLayoutResult {
  const { sourceNode, newNodes, existingNodes } = input

  if (newNodes.length === 0) {
    return { positions: new Map() }
  }

  const sourceCx = sourceNode.position.x + sourceNode.size.width / 2
  const sourceCy = sourceNode.position.y + sourceNode.size.height / 2

  // Radial distance scales with connection count
  const radialDistance = Math.max(
    MIN_RADIAL_DISTANCE,
    200 + newNodes.length * RADIAL_DISTANCE_PER_NODE
  )

  // Build simulation nodes
  const simNodes: SimNode[] = []

  // Source node: fixed at center
  simNodes.push({
    index: 0,
    x: sourceCx,
    y: sourceCy,
    vx: 0,
    vy: 0,
    fx: sourceCx,
    fy: sourceCy,
    id: '__source__',
    radius: boundingRadius(sourceNode.size) + COLLISION_PADDING
  })

  // New nodes: initialized on radial ring
  const angleStep = (2 * Math.PI) / newNodes.length
  for (let i = 0; i < newNodes.length; i++) {
    const angle = angleStep * i - Math.PI / 2
    const initX = sourceCx + Math.cos(angle) * radialDistance
    const initY = sourceCy + Math.sin(angle) * radialDistance

    simNodes.push({
      index: simNodes.length,
      x: initX,
      y: initY,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      id: newNodes[i].id,
      radius: boundingRadius(newNodes[i].size) + COLLISION_PADDING
    })
  }

  // Existing nodes: fixed obstacles
  for (const existing of existingNodes) {
    // Skip the source node itself (already added)
    if (existing.id === sourceNode.id) continue

    const cx = existing.position.x + existing.size.width / 2
    const cy = existing.position.y + existing.size.height / 2

    simNodes.push({
      index: simNodes.length,
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      fx: cx,
      fy: cy,
      id: existing.id,
      radius: boundingRadius(existing.size) + COLLISION_PADDING
    })
  }

  // Build and run simulation synchronously
  // Pinned nodes (source + existing) contribute zero charge so they don't
  // shove new cards away. Collision still handles obstacle avoidance.
  const sim = forceSimulation<SimNode>(simNodes)
    .force(
      'collide',
      forceCollide<SimNode>((d) => d.radius)
    )
    .force(
      'charge',
      forceManyBody<SimNode>()
        .strength((d) => (d.fx !== null ? 0 : REPEL_STRENGTH))
        .distanceMax(800)
    )
    .force(
      'radial',
      forceRadial<SimNode>(radialDistance, sourceCx, sourceCy).strength(RADIAL_STRENGTH)
    )
    .alphaDecay(1 - Math.pow(0.001, 1 / MAX_TICKS))
    .stop()

  for (let i = 0; i < MAX_TICKS; i++) {
    sim.tick()
  }

  // Extract positions for new nodes only
  const newNodeIds = new Set(newNodes.map((n) => n.id))
  const positions = new Map<string, { x: number; y: number }>()

  for (const simNode of simNodes) {
    if (newNodeIds.has(simNode.id)) {
      // Convert from center coordinates back to top-left
      const nodeSpec = newNodes.find((n) => n.id === simNode.id)!
      positions.set(simNode.id, {
        x: simNode.x - nodeSpec.size.width / 2,
        y: simNode.y - nodeSpec.size.height / 2
      })
    }
  }

  return { positions }
}

// ---------------------------------------------------------------------------
// 4. Single-card collision avoidance (file drops)
// ---------------------------------------------------------------------------

const SPIRAL_STEP = 40
const MAX_SPIRAL_RADIUS = 2000
const DEFAULT_PADDING = 20

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  padding: number
): boolean {
  return (
    ax < bx + bw + padding &&
    ax + aw + padding > bx &&
    ay < by + bh + padding &&
    ay + ah + padding > by
  )
}

function hasOverlap(
  x: number,
  y: number,
  w: number,
  h: number,
  nodes: readonly CanvasNode[],
  padding: number
): boolean {
  for (const node of nodes) {
    if (
      rectsOverlap(
        x,
        y,
        w,
        h,
        node.position.x,
        node.position.y,
        node.size.width,
        node.size.height,
        padding
      )
    ) {
      return true
    }
  }
  return false
}

export function findOpenPosition(
  desired: { x: number; y: number },
  size: { width: number; height: number },
  existingNodes: readonly CanvasNode[],
  padding: number = DEFAULT_PADDING
): { x: number; y: number } {
  // Fast path: no existing nodes
  if (existingNodes.length === 0) {
    return { x: desired.x, y: desired.y }
  }

  // Check if desired position is already clear
  if (!hasOverlap(desired.x, desired.y, size.width, size.height, existingNodes, padding)) {
    return { x: desired.x, y: desired.y }
  }

  // Spiral outward to find open space
  for (let radius = SPIRAL_STEP; radius <= MAX_SPIRAL_RADIUS; radius += SPIRAL_STEP) {
    // Number of points on this ring scales with circumference
    const pointCount = Math.max(8, Math.floor((2 * Math.PI * radius) / SPIRAL_STEP))
    for (let i = 0; i < pointCount; i++) {
      const angle = (2 * Math.PI * i) / pointCount
      const candidateX = desired.x + Math.cos(angle) * radius
      const candidateY = desired.y + Math.sin(angle) * radius

      if (!hasOverlap(candidateX, candidateY, size.width, size.height, existingNodes, padding)) {
        return { x: candidateX, y: candidateY }
      }
    }
  }

  // Fallback: place to the right of all existing nodes
  let maxRight = -Infinity
  for (const node of existingNodes) {
    const right = node.position.x + node.size.width
    if (right > maxRight) maxRight = right
  }
  return { x: maxRight + 100, y: desired.y }
}
