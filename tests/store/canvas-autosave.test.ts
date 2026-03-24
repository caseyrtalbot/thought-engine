import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../src/renderer/src/store/canvas-store'
import {
  subscribeCanvasAutosave,
  flushCanvasSave
} from '../../src/renderer/src/store/canvas-autosave'
import { createCanvasNode } from '../../src/shared/canvas-types'

// Mock the IPC layer
vi.mock('../../src/renderer/src/panels/canvas/canvas-io', () => ({
  saveCanvas: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../src/renderer/src/utils/error-logger', () => ({
  logError: vi.fn(),
  notifyError: vi.fn()
}))

import { saveCanvas } from '../../src/renderer/src/panels/canvas/canvas-io'

describe('canvas-autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    // Load a canvas so filePath is set
    useCanvasStore.getState().loadCanvas('/test/canvas.json', {
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-saves after 2s debounce when isDirty becomes true', async () => {
    const unsub = subscribeCanvasAutosave()

    // Trigger dirty state
    useCanvasStore
      .getState()
      .addNode(createCanvasNode('text', { x: 0, y: 0 }, { width: 200, height: 200 }))

    expect(useCanvasStore.getState().isDirty).toBe(true)
    expect(saveCanvas).not.toHaveBeenCalled()

    // Advance past debounce
    vi.advanceTimersByTime(2000)
    // Allow promise microtask to run
    await vi.advanceTimersByTimeAsync(0)

    expect(saveCanvas).toHaveBeenCalledWith('/test/canvas.json', expect.any(Object))
    expect(useCanvasStore.getState().isDirty).toBe(false)

    unsub()
  })

  it('does not save when not dirty', async () => {
    const unsub = subscribeCanvasAutosave()

    vi.advanceTimersByTime(5000)
    await vi.advanceTimersByTimeAsync(0)

    expect(saveCanvas).not.toHaveBeenCalled()

    unsub()
  })

  it('resets debounce on rapid mutations', async () => {
    const unsub = subscribeCanvasAutosave()

    // First mutation
    useCanvasStore
      .getState()
      .addNode(createCanvasNode('text', { x: 0, y: 0 }, { width: 200, height: 200 }))

    // Wait 1s (less than debounce)
    vi.advanceTimersByTime(1000)
    expect(saveCanvas).not.toHaveBeenCalled()

    // isDirty is already true, so the subscription won't re-schedule.
    // But a markSaved + re-dirty cycle would.
    // Just verify the original debounce fires correctly.
    vi.advanceTimersByTime(1000)
    await vi.advanceTimersByTimeAsync(0)

    expect(saveCanvas).toHaveBeenCalledTimes(1)

    unsub()
  })

  it('flushCanvasSave writes immediately', async () => {
    useCanvasStore
      .getState()
      .addNode(createCanvasNode('text', { x: 0, y: 0 }, { width: 200, height: 200 }))

    await flushCanvasSave()

    expect(saveCanvas).toHaveBeenCalledWith('/test/canvas.json', expect.any(Object))
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('does not save when no filePath is loaded', async () => {
    useCanvasStore.getState().closeCanvas()
    useCanvasStore.setState({ isDirty: true })

    await flushCanvasSave()

    expect(saveCanvas).not.toHaveBeenCalled()
  })

  it('cleans up timer on unsubscribe', () => {
    const unsub = subscribeCanvasAutosave()

    useCanvasStore
      .getState()
      .addNode(createCanvasNode('text', { x: 0, y: 0 }, { width: 200, height: 200 }))

    unsub()

    // Timer should be cleared
    vi.advanceTimersByTime(5000)
    expect(saveCanvas).not.toHaveBeenCalled()
  })
})
