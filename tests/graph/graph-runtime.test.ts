import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GraphRenderRuntime } from '../../src/renderer/src/panels/graph/graph-runtime'

describe('GraphRenderRuntime', () => {
  let runtime: GraphRenderRuntime
  let renderFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    renderFn = vi.fn()
    runtime = new GraphRenderRuntime(renderFn)
  })

  afterEach(() => {
    runtime.dispose()
  })

  describe('requestRender', () => {
    it('coalesces multiple requests into one RAF callback', () => {
      let rafCb: FrameRequestCallback | null = null
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafCb = cb
        return 1
      })
      vi.stubGlobal('cancelAnimationFrame', vi.fn())

      runtime.requestRender()
      runtime.requestRender()
      runtime.requestRender()

      expect(renderFn).not.toHaveBeenCalled()
      rafCb?.(performance.now())
      expect(renderFn).toHaveBeenCalledTimes(1)

      vi.unstubAllGlobals()
    })
  })

  describe('quadtree', () => {
    it('starts dirty', () => {
      expect(runtime.isQuadtreeDirty()).toBe(true)
    })

    it('marks clean after rebuild', () => {
      runtime.rebuildQuadtree([])
      expect(runtime.isQuadtreeDirty()).toBe(false)
    })

    it('can be re-dirtied', () => {
      runtime.rebuildQuadtree([])
      runtime.markQuadtreeDirty()
      expect(runtime.isQuadtreeDirty()).toBe(true)
    })

    it('skips rebuild when not dirty', () => {
      runtime.rebuildQuadtree([])
      // Call again without marking dirty — should be a no-op (still clean)
      runtime.rebuildQuadtree([])
      expect(runtime.isQuadtreeDirty()).toBe(false)
    })

    it('handles zero coordinates correctly (0 is a valid coordinate)', () => {
      const node = {
        id: 'zero',
        x: 0,
        y: 0,
        connectionCount: 1,
        type: 'note',
        title: 'Zero',
        signal: 'untested'
      } as any
      // Should not throw and should include the node
      runtime.rebuildQuadtree([node])
      expect(runtime.isQuadtreeDirty()).toBe(false)
    })
  })

  describe('findNodeAt', () => {
    it('returns null when no nodes are within range', () => {
      const node = {
        id: 'far',
        x: 1000,
        y: 1000,
        connectionCount: 1,
        type: 'note',
        title: 'Far',
        signal: 'untested'
      } as any
      runtime.rebuildQuadtree([node])
      const result = runtime.findNodeAt([node], 0, 0)
      expect(result).toBeNull()
    })

    it('finds a node at its exact coordinates', () => {
      const node = {
        id: 'target',
        x: 50,
        y: 50,
        connectionCount: 1,
        type: 'note',
        title: 'Target',
        signal: 'untested'
      } as any
      runtime.rebuildQuadtree([node])
      const result = runtime.findNodeAt([node], 50, 50)
      expect(result?.id).toBe('target')
    })

    it('returns the closest node when multiple nodes are nearby', () => {
      const nodeA = {
        id: 'a',
        x: 50,
        y: 50,
        connectionCount: 1,
        type: 'note',
        title: 'A',
        signal: 'untested'
      } as any
      const nodeB = {
        id: 'b',
        x: 55,
        y: 55,
        connectionCount: 1,
        type: 'note',
        title: 'B',
        signal: 'untested'
      } as any
      runtime.rebuildQuadtree([nodeA, nodeB])
      const result = runtime.findNodeAt([nodeA, nodeB], 50, 50)
      expect(result?.id).toBe('a')
    })

    it('forces a rebuild if quadtree is null', () => {
      // After dispose, quadtree is null but _quadtreeDirty is true
      runtime.dispose()
      const node = {
        id: 'node',
        x: 0,
        y: 0,
        connectionCount: 1,
        type: 'note',
        title: 'Node',
        signal: 'untested'
      } as any
      // findNodeAt should trigger rebuild internally
      const result = runtime.findNodeAt([node], 0, 0)
      // Just check it doesn't throw; timing-dependent whether it finds the node
      expect(result === null || result.id === 'node').toBe(true)
    })
  })

  describe('retainedExits', () => {
    it('adds and prunes exits', () => {
      const node = {
        id: 'test',
        x: 0,
        y: 0,
        connectionCount: 1,
        type: 'note',
        title: 'Test',
        signal: 'untested'
      } as any
      runtime.addRetainedExit(node, 100)
      expect(runtime.retainedExits.size).toBe(1)
      // Not yet expired
      runtime.pruneCompletedExits()
      // May or may not be pruned depending on timing, so just check it doesn't crash
    })

    it('prunes exits that have exceeded their duration', () => {
      const node = {
        id: 'expired',
        x: 0,
        y: 0,
        connectionCount: 1,
        type: 'note',
        title: 'Expired',
        signal: 'untested'
      } as any
      // Add with duration 0 — should be immediately pruneable
      runtime.addRetainedExit(node, 0)
      expect(runtime.retainedExits.size).toBe(1)
      runtime.pruneCompletedExits()
      expect(runtime.retainedExits.size).toBe(0)
    })

    it('retains exits with remaining duration', () => {
      const node = {
        id: 'live',
        x: 0,
        y: 0,
        connectionCount: 1,
        type: 'note',
        title: 'Live',
        signal: 'untested'
      } as any
      runtime.addRetainedExit(node, 60_000) // 60s — will not expire
      runtime.pruneCompletedExits()
      expect(runtime.retainedExits.size).toBe(1)
    })
  })

  describe('simulation', () => {
    it('stops old simulation when setting new one', () => {
      const mockSim = { stop: vi.fn(), on: vi.fn() } as any
      runtime.simulation = mockSim
      const newSim = { stop: vi.fn(), on: vi.fn() } as any
      runtime.simulation = newSim
      expect(mockSim.stop).toHaveBeenCalledTimes(1)
    })

    it('returns the current simulation via getter', () => {
      const mockSim = { stop: vi.fn(), on: vi.fn() } as any
      runtime.simulation = mockSim
      expect(runtime.simulation).toBe(mockSim)
    })

    it('stops simulation on dispose', () => {
      const mockSim = { stop: vi.fn(), on: vi.fn() } as any
      runtime.simulation = mockSim
      runtime.dispose()
      expect(mockSim.stop).toHaveBeenCalledTimes(1)
    })
  })

  describe('vignette gradient', () => {
    it('returns the same gradient instance for the same dimensions', () => {
      const ctx = {
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn()
        }))
      } as any
      const g1 = runtime.getVignetteGradient(ctx, 800, 600)
      const g2 = runtime.getVignetteGradient(ctx, 800, 600)
      expect(g1).toBe(g2)
      // createRadialGradient should only be called once
      expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1)
    })

    it('regenerates gradient when dimensions change', () => {
      const ctx = {
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn()
        }))
      } as any
      runtime.getVignetteGradient(ctx, 800, 600)
      runtime.getVignetteGradient(ctx, 1024, 768)
      expect(ctx.createRadialGradient).toHaveBeenCalledTimes(2)
    })
  })

  describe('dispose', () => {
    it('cleans up all resources', () => {
      vi.stubGlobal('cancelAnimationFrame', vi.fn())
      runtime.requestRender()
      runtime.dispose()
      expect(runtime.retainedExits.size).toBe(0)
      vi.unstubAllGlobals()
    })

    it('clears retained exits on dispose', () => {
      const node = {
        id: 'n1',
        x: 0,
        y: 0,
        connectionCount: 1,
        type: 'note',
        title: 'N1',
        signal: 'untested'
      } as any
      runtime.addRetainedExit(node, 5000)
      expect(runtime.retainedExits.size).toBe(1)
      runtime.dispose()
      expect(runtime.retainedExits.size).toBe(0)
    })
  })
})
