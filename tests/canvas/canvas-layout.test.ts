import { describe, it, expect } from 'vitest'
import {
  computeCardSize,
  computeOptimalEdgeSides,
  computeForceLayout,
  findOpenPosition,
  type ContentMetrics
} from '../../src/renderer/src/panels/canvas/canvas-layout'
import { createCanvasNode } from '../../src/shared/canvas-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
  x: number,
  y: number,
  w: number = 280,
  h: number = 200,
  id?: string
): ReturnType<typeof createCanvasNode> {
  const node = createCanvasNode('note', { x, y }, { size: { width: w, height: h } })
  if (id) {
    return { ...node, id }
  }
  return node
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  padding: number = 0
): boolean {
  return (
    a.x < b.x + b.w + padding &&
    a.x + a.w + padding > b.x &&
    a.y < b.y + b.h + padding &&
    a.y + a.h + padding > b.y
  )
}

// ---------------------------------------------------------------------------
// computeCardSize
// ---------------------------------------------------------------------------

describe('computeCardSize', () => {
  it('returns minimum height for empty content', () => {
    const metrics: ContentMetrics = { titleLength: 0, bodyLength: 0, metadataCount: 0 }
    const size = computeCardSize(metrics)
    expect(size.width).toBe(380)
    expect(size.height).toBeGreaterThanOrEqual(100) // MIN_SIZES.note.height
  })

  it('expands width for long titles', () => {
    const metrics: ContentMetrics = { titleLength: 50, bodyLength: 0, metadataCount: 0 }
    const size = computeCardSize(metrics)
    expect(size.width).toBe(420)
  })

  it('expands width for many metadata fields', () => {
    const metrics: ContentMetrics = { titleLength: 10, bodyLength: 0, metadataCount: 6 }
    const size = computeCardSize(metrics)
    expect(size.width).toBe(420)
  })

  it('grows height with metadata rows', () => {
    const small: ContentMetrics = { titleLength: 10, bodyLength: 0, metadataCount: 2 }
    const large: ContentMetrics = { titleLength: 10, bodyLength: 0, metadataCount: 8 }
    const smallSize = computeCardSize(small)
    const largeSize = computeCardSize(large)
    expect(largeSize.height).toBeGreaterThan(smallSize.height)
  })

  it('grows height with body length', () => {
    const short: ContentMetrics = { titleLength: 10, bodyLength: 100, metadataCount: 2 }
    const long: ContentMetrics = { titleLength: 10, bodyLength: 2000, metadataCount: 2 }
    const shortSize = computeCardSize(short)
    const longSize = computeCardSize(long)
    expect(longSize.height).toBeGreaterThan(shortSize.height)
  })

  it('caps height at note default size', () => {
    const metrics: ContentMetrics = { titleLength: 10, bodyLength: 10000, metadataCount: 20 }
    const size = computeCardSize(metrics)
    expect(size.height).toBeLessThanOrEqual(550) // DEFAULT_SIZES.note.height
  })

  it('caps width at note default size', () => {
    const metrics: ContentMetrics = { titleLength: 100, bodyLength: 0, metadataCount: 10 }
    const size = computeCardSize(metrics)
    expect(size.width).toBeLessThanOrEqual(450) // DEFAULT_SIZES.note.width
  })
})

// ---------------------------------------------------------------------------
// computeOptimalEdgeSides
// ---------------------------------------------------------------------------

describe('computeOptimalEdgeSides', () => {
  const baseNode = { position: { x: 0, y: 0 }, size: { width: 200, height: 100 } }

  it('returns right->left when target is to the right', () => {
    const target = { position: { x: 400, y: 0 }, size: { width: 200, height: 100 } }
    const sides = computeOptimalEdgeSides(baseNode, target)
    expect(sides).toEqual({ fromSide: 'right', toSide: 'left' })
  })

  it('returns left->right when target is to the left', () => {
    const target = { position: { x: -400, y: 0 }, size: { width: 200, height: 100 } }
    const sides = computeOptimalEdgeSides(baseNode, target)
    expect(sides).toEqual({ fromSide: 'left', toSide: 'right' })
  })

  it('returns bottom->top when target is below', () => {
    const target = { position: { x: 0, y: 400 }, size: { width: 200, height: 100 } }
    const sides = computeOptimalEdgeSides(baseNode, target)
    expect(sides).toEqual({ fromSide: 'bottom', toSide: 'top' })
  })

  it('returns top->bottom when target is above', () => {
    const target = { position: { x: 0, y: -400 }, size: { width: 200, height: 100 } }
    const sides = computeOptimalEdgeSides(baseNode, target)
    expect(sides).toEqual({ fromSide: 'top', toSide: 'bottom' })
  })

  it('uses horizontal sides for diagonal when dx > dy', () => {
    const target = { position: { x: 400, y: 200 }, size: { width: 200, height: 100 } }
    const sides = computeOptimalEdgeSides(baseNode, target)
    expect(sides.fromSide).toBe('right')
    expect(sides.toSide).toBe('left')
  })

  it('uses vertical sides for diagonal when dy > dx', () => {
    const target = { position: { x: 100, y: 500 }, size: { width: 200, height: 100 } }
    const sides = computeOptimalEdgeSides(baseNode, target)
    expect(sides.fromSide).toBe('bottom')
    expect(sides.toSide).toBe('top')
  })

  it('defaults to horizontal when nodes are exactly diagonal', () => {
    const target = { position: { x: 300, y: 300 }, size: { width: 200, height: 100 } }
    const sides = computeOptimalEdgeSides(baseNode, target)
    // Equal dx and dy: Math.abs(dx) >= Math.abs(dy) is true, so horizontal
    expect(sides.fromSide).toBe('right')
  })
})

// ---------------------------------------------------------------------------
// computeForceLayout
// ---------------------------------------------------------------------------

describe('computeForceLayout', () => {
  it('returns empty map for no new nodes', () => {
    const source = makeNode(0, 0, 300, 200, 'source')
    const result = computeForceLayout({
      sourceNode: source,
      newNodes: [],
      existingNodes: [source]
    })
    expect(result.positions.size).toBe(0)
  })

  it('places a single new node near the source', () => {
    const source = makeNode(0, 0, 300, 200, 'source')
    const result = computeForceLayout({
      sourceNode: source,
      newNodes: [{ id: 'n1', size: { width: 280, height: 200 } }],
      existingNodes: [source]
    })
    expect(result.positions.size).toBe(1)
    const pos = result.positions.get('n1')!
    expect(pos).toBeDefined()
    // Should be roughly 350px away from source center (150, 100)
    const distX = pos.x + 140 - 150 // center of new node - center of source
    const distY = pos.y + 100 - 100
    const dist = Math.sqrt(distX * distX + distY * distY)
    expect(dist).toBeGreaterThan(200)
    expect(dist).toBeLessThan(600)
  })

  it('produces non-overlapping positions for multiple new nodes', () => {
    const source = makeNode(500, 500, 300, 200, 'source')
    const newNodes = Array.from({ length: 8 }, (_, i) => ({
      id: `n${i}`,
      size: { width: 280, height: 200 }
    }))

    const result = computeForceLayout({
      sourceNode: source,
      newNodes,
      existingNodes: [source]
    })

    expect(result.positions.size).toBe(8)

    // Check all pairs for non-overlap
    const placed = [...result.positions.entries()].map(([id, pos]) => {
      const spec = newNodes.find((n) => n.id === id)!
      return { x: pos.x, y: pos.y, w: spec.size.width, h: spec.size.height }
    })

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const overlaps = rectsOverlap(placed[i], placed[j])
        expect(overlaps, `nodes ${i} and ${j} should not overlap`).toBe(false)
      }
    }
  })

  it('avoids existing nodes on the canvas', () => {
    const source = makeNode(500, 500, 300, 200, 'source')
    // Place existing obstacle right where a radial placement would go
    const obstacle = makeNode(850, 400, 280, 200, 'obstacle')

    const result = computeForceLayout({
      sourceNode: source,
      newNodes: [{ id: 'n1', size: { width: 280, height: 200 } }],
      existingNodes: [source, obstacle]
    })

    const pos = result.positions.get('n1')!
    const newRect = { x: pos.x, y: pos.y, w: 280, h: 200 }
    const obstacleRect = {
      x: obstacle.position.x,
      y: obstacle.position.y,
      w: obstacle.size.width,
      h: obstacle.size.height
    }

    expect(rectsOverlap(newRect, obstacleRect)).toBe(false)
  })

  it('does not move the source node', () => {
    const source = makeNode(100, 100, 300, 200, 'source')
    const result = computeForceLayout({
      sourceNode: source,
      newNodes: [{ id: 'n1', size: { width: 280, height: 200 } }],
      existingNodes: [source]
    })
    // Source should not appear in results
    expect(result.positions.has('source')).toBe(false)
    expect(result.positions.has('__source__')).toBe(false)
  })

  it('handles many connections (20 nodes) without overlaps', () => {
    const source = makeNode(1000, 1000, 300, 200, 'source')
    const newNodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      size: { width: 260, height: 180 }
    }))

    const result = computeForceLayout({
      sourceNode: source,
      newNodes,
      existingNodes: [source]
    })

    expect(result.positions.size).toBe(20)

    const placed = [...result.positions.entries()].map(([id, pos]) => {
      const spec = newNodes.find((n) => n.id === id)!
      return { x: pos.x, y: pos.y, w: spec.size.width, h: spec.size.height }
    })

    let overlapCount = 0
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (rectsOverlap(placed[i], placed[j])) overlapCount++
      }
    }
    expect(overlapCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// findOpenPosition
// ---------------------------------------------------------------------------

describe('findOpenPosition', () => {
  it('returns desired position on empty canvas', () => {
    const pos = findOpenPosition({ x: 100, y: 200 }, { width: 280, height: 200 }, [])
    expect(pos).toEqual({ x: 100, y: 200 })
  })

  it('returns desired position when no overlap exists', () => {
    const existing = [makeNode(0, 0, 200, 100)]
    const pos = findOpenPosition({ x: 500, y: 500 }, { width: 280, height: 200 }, existing)
    expect(pos).toEqual({ x: 500, y: 500 })
  })

  it('nudges position to avoid a single overlapping node', () => {
    const existing = [makeNode(100, 100, 280, 200)]
    // Place exactly on top of existing
    const pos = findOpenPosition({ x: 100, y: 100 }, { width: 280, height: 200 }, existing)
    // Should NOT be at the original position
    expect(pos.x !== 100 || pos.y !== 100).toBe(true)
    // Should NOT overlap
    const overlap = rectsOverlap(
      { x: pos.x, y: pos.y, w: 280, h: 200 },
      { x: 100, y: 100, w: 280, h: 200 },
      20 // default padding
    )
    expect(overlap).toBe(false)
  })

  it('finds open space in a dense area', () => {
    // Create a 3x3 grid of cards
    const existing = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        existing.push(makeNode(col * 300, row * 220, 280, 200))
      }
    }
    // Try to place in the middle of the grid
    const pos = findOpenPosition({ x: 300, y: 220 }, { width: 280, height: 200 }, existing)
    // Should find a position that doesn't overlap any existing node
    for (const node of existing) {
      const overlap = rectsOverlap(
        { x: pos.x, y: pos.y, w: 280, h: 200 },
        { x: node.position.x, y: node.position.y, w: node.size.width, h: node.size.height },
        20
      )
      expect(overlap, `should not overlap node at ${node.position.x},${node.position.y}`).toBe(
        false
      )
    }
  })
})
