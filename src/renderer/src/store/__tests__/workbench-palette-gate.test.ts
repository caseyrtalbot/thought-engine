import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useWorkbenchActionStore } from '../workbench-actions-store'

/**
 * Tests the disabled gate logic that App.tsx uses to determine
 * whether workbench palette commands are available.
 * The gate is: disabled = handler == null
 */

function isWorkbenchCommandDisabled(actionKey: keyof typeof WORKBENCH_ACTION_KEYS): boolean {
  const state = useWorkbenchActionStore.getState()
  const handler = state[actionKey]
  return handler == null
}

const WORKBENCH_ACTION_KEYS = {
  refresh: 'refresh',
  fitAll: 'fitAll',
  addTerminal: 'addTerminal',
  createTension: 'createTension',
  savePattern: 'savePattern',
  endSession: 'endSession',
  toggleThread: 'toggleThread'
} as const

describe('workbench palette disabled gate', () => {
  beforeEach(() => {
    useWorkbenchActionStore.getState().reset()
  })

  it('all workbench commands are disabled when no handlers registered', () => {
    for (const key of Object.values(WORKBENCH_ACTION_KEYS)) {
      expect(isWorkbenchCommandDisabled(key)).toBe(true)
    }
  })

  it('all workbench commands are enabled after registration', () => {
    useWorkbenchActionStore.getState().setRegistration({
      refresh: vi.fn(),
      fitAll: vi.fn(),
      addTerminal: vi.fn(),
      createTension: vi.fn(),
      savePattern: vi.fn(),
      endSession: vi.fn(),
      toggleThread: vi.fn(),
      selectedNodeCount: 0,
      milestoneCount: 0,
      isLive: false,
      threadOpen: false
    })

    for (const key of Object.values(WORKBENCH_ACTION_KEYS)) {
      expect(isWorkbenchCommandDisabled(key)).toBe(false)
    }
  })

  it('commands become disabled again after reset (simulating tab switch away)', () => {
    useWorkbenchActionStore.getState().setRegistration({
      refresh: vi.fn(),
      fitAll: vi.fn(),
      addTerminal: vi.fn(),
      createTension: vi.fn(),
      savePattern: vi.fn(),
      endSession: vi.fn(),
      toggleThread: vi.fn(),
      selectedNodeCount: 0,
      milestoneCount: 0,
      isLive: false,
      threadOpen: false
    })

    useWorkbenchActionStore.getState().reset()

    for (const key of Object.values(WORKBENCH_ACTION_KEYS)) {
      expect(isWorkbenchCommandDisabled(key)).toBe(true)
    }
  })

  it('savePattern has additional disabled condition based on selectedNodeCount', () => {
    useWorkbenchActionStore.getState().setRegistration({
      refresh: vi.fn(),
      fitAll: vi.fn(),
      addTerminal: vi.fn(),
      createTension: vi.fn(),
      savePattern: vi.fn(),
      endSession: vi.fn(),
      toggleThread: vi.fn(),
      selectedNodeCount: 0,
      milestoneCount: 0,
      isLive: false,
      threadOpen: false
    })

    // App.tsx uses: disabled: savePattern == null || selectedNodeCount === 0
    const state = useWorkbenchActionStore.getState()
    const savePatternDisabled = state.savePattern == null || state.selectedNodeCount === 0
    expect(savePatternDisabled).toBe(true)

    // With selection
    useWorkbenchActionStore.getState().setRegistration({
      ...state,
      selectedNodeCount: 2
    })
    const updated = useWorkbenchActionStore.getState()
    const afterSelection = updated.savePattern == null || updated.selectedNodeCount === 0
    expect(afterSelection).toBe(false)
  })
})
