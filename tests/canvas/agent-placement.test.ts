import { describe, it, expect } from 'vitest'
import {
  computeAgentPlacement,
  rectsOverlap
} from '../../src/renderer/src/panels/canvas/agent-placement'
import type { CanvasNode } from '../../src/shared/canvas-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViewport(x = 0, y = 0, zoom = 1, width = 1200, height = 800) {
  return { x, y, zoom, width, height }
}

function makeNode(id: string, x: number, y: number, width = 320, height = 240): CanvasNode {
  return {
    id,
    type: 'agent-session',
    position: { x, y },
    size: { width, height },
    content: '',
    metadata: {}
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeAgentPlacement', () => {
  it('returns viewport center when no sourceNodeId', () => {
    const viewport = makeViewport(0, 0, 1, 1200, 800)
    const result = computeAgentPlacement(undefined, [], viewport)
    expect(result).toEqual({ x: 600, y: 400 })
  })

  it('accounts for zoom and offset when computing viewport center', () => {
    // viewport panned to (100, 200), zoomed to 2x
    // center = (100 + 1200 / (2*2), 200 + 800 / (2*2)) = (400, 400)
    const viewport = makeViewport(100, 200, 2, 1200, 800)
    const result = computeAgentPlacement(undefined, [], viewport)
    expect(result).toEqual({ x: 400, y: 400 })
  })

  it('places to the right of source node when sourceNodeId exists', () => {
    const source = makeNode('src-1', 100, 200, 320, 240)
    const viewport = makeViewport()
    const result = computeAgentPlacement('src-1', [source], viewport)
    // x = 100 + 320 + 40 (gap) = 460, y = 200 (same as source)
    expect(result).toEqual({ x: 460, y: 200 })
  })

  it('shifts down when right-of-source position collides with existing node', () => {
    const source = makeNode('src-1', 100, 200, 320, 240)
    // Blocker sits exactly where the new card would go (x=460, y=200)
    const blocker = makeNode('blocker', 460, 200, 320, 240)
    const viewport = makeViewport()
    const result = computeAgentPlacement('src-1', [source, blocker], viewport)
    // Should shift down: y = 200 + 240 + 40 = 480
    expect(result).toEqual({ x: 460, y: 480 })
  })

  it('shifts down multiple times to avoid stacked collisions', () => {
    const source = makeNode('src-1', 100, 200, 320, 240)
    const blocker1 = makeNode('b1', 460, 200, 320, 240)
    const blocker2 = makeNode('b2', 460, 480, 320, 240)
    const viewport = makeViewport()
    const result = computeAgentPlacement('src-1', [source, blocker1, blocker2], viewport)
    // First shift: y=480 (collides with b2), second shift: y=760
    expect(result).toEqual({ x: 460, y: 760 })
  })

  it('falls back to viewport center when sourceNodeId not found in nodes', () => {
    const other = makeNode('other-1', 100, 200)
    const viewport = makeViewport(0, 0, 1, 1200, 800)
    const result = computeAgentPlacement('nonexistent', [other], viewport)
    expect(result).toEqual({ x: 600, y: 400 })
  })

  it('does not collide with non-overlapping node to the side', () => {
    const source = makeNode('src-1', 100, 200, 320, 240)
    // Node far to the right, no overlap with proposed position (460, 200)
    const farAway = makeNode('far', 900, 200, 320, 240)
    const viewport = makeViewport()
    const result = computeAgentPlacement('src-1', [source, farAway], viewport)
    expect(result).toEqual({ x: 460, y: 200 })
  })
})

describe('rectsOverlap', () => {
  it('returns true for overlapping rects', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 }
    const b = { x: 50, y: 50, w: 100, h: 100 }
    expect(rectsOverlap(a, b)).toBe(true)
  })

  it('returns false for non-overlapping rects', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 }
    const b = { x: 200, y: 200, w: 100, h: 100 }
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('returns false for touching edges (exactly adjacent)', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 }
    const b = { x: 100, y: 0, w: 100, h: 100 }
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('returns true for fully contained rect', () => {
    const a = { x: 0, y: 0, w: 200, h: 200 }
    const b = { x: 50, y: 50, w: 50, h: 50 }
    expect(rectsOverlap(a, b)).toBe(true)
  })

  it('returns false for rects separated vertically', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 }
    const b = { x: 0, y: 200, w: 100, h: 100 }
    expect(rectsOverlap(a, b)).toBe(false)
  })
})
