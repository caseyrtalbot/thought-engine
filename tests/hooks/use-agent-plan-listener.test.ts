import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../src/renderer/src/store/canvas-store'
import type { CanvasMutationPlan } from '../../src/shared/canvas-mutation-types'

// Capture the IPC callback so we can simulate events
let capturedCallback: ((data: { plan: CanvasMutationPlan }) => void) | null = null
const mockUnsubscribe = vi.fn(() => {
  capturedCallback = null
})

vi.stubGlobal('window', {
  ...window,
  api: {
    ...((window as Record<string, unknown>).api ?? {}),
    on: {
      canvasAgentPlanAccepted: vi.fn((cb: typeof capturedCallback) => {
        capturedCallback = cb
        return mockUnsubscribe
      })
    }
  }
})

// Import hook after mock is established
const { useAgentPlanListener } =
  await import('../../src/renderer/src/hooks/use-agent-plan-listener')

const makePlan = (id: string): CanvasMutationPlan => ({
  id,
  operationId: `op_${id}`,
  source: 'agent',
  ops: [
    {
      type: 'add-node',
      node: {
        id: `n_${id}`,
        type: 'text',
        position: { x: 0, y: 0 },
        size: { width: 240, height: 80 },
        content: 'agent-added',
        metadata: {}
      }
    }
  ],
  summary: {
    addedNodes: 1,
    addedEdges: 0,
    movedNodes: 0,
    skippedFiles: 0,
    unresolvedRefs: 0
  }
})

describe('useAgentPlanListener', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getInitialState())
    capturedCallback = null
    mockUnsubscribe.mockClear()
    vi.mocked(window.api.on.canvasAgentPlanAccepted).mockClear()
  })

  afterEach(() => {
    capturedCallback = null
  })

  it('subscribes to canvasAgentPlanAccepted on mount', () => {
    renderHook(() => useAgentPlanListener())
    expect(window.api.on.canvasAgentPlanAccepted).toHaveBeenCalledOnce()
    expect(capturedCallback).toBeTypeOf('function')
  })

  it('calls applyAgentPlan on the store when event fires', () => {
    const spy = vi.spyOn(useCanvasStore.getState(), 'applyAgentPlan')
    renderHook(() => useAgentPlanListener())

    const plan = makePlan('test1')
    capturedCallback!({ plan })

    // applyAgentPlan is on the store instance, but getState() returns a new ref
    // after set() calls, so check the store state instead
    const { nodes } = useCanvasStore.getState()
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('n_test1')
    expect(nodes[0].content).toBe('agent-added')
    spy.mockRestore()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAgentPlanListener())
    expect(mockUnsubscribe).not.toHaveBeenCalled()

    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })
})
