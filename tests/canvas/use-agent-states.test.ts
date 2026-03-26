import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import type { AgentSidecarState } from '../../src/shared/agent-types'

const mockGetStates = vi.fn<() => Promise<AgentSidecarState[]>>()
const mockAgentStatesChanged =
  vi.fn<(cb: (data: { states: readonly AgentSidecarState[] }) => void) => () => void>()

vi.stubGlobal('window', {
  api: {
    agent: {
      getStates: mockGetStates
    },
    on: {
      agentStatesChanged: mockAgentStatesChanged
    }
  }
})

// Import after mocks are set up
const { useAgentStates } = await import('../../src/renderer/src/hooks/use-agent-states')

function makeState(overrides?: Partial<AgentSidecarState>): AgentSidecarState {
  return {
    sessionId: 'session-1',
    tmuxName: 'te-abc123',
    status: 'alive',
    ...overrides
  }
}

describe('useAgentStates', () => {
  let unsubscribe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    unsubscribe = vi.fn()
    mockGetStates.mockReset()
    mockAgentStatesChanged.mockReset()
    mockAgentStatesChanged.mockReturnValue(unsubscribe)
  })

  afterEach(() => {
    cleanup()
  })

  it('returns initial states from getStates on mount', async () => {
    const states = [makeState({ sessionId: 'sess-a' }), makeState({ sessionId: 'sess-b' })]
    mockGetStates.mockResolvedValue(states)

    const { result } = renderHook(() => useAgentStates())

    // Initially empty
    expect(result.current).toEqual([])

    // Wait for async getStates to resolve
    await act(async () => {
      await mockGetStates.mock.results[0]?.value
    })

    expect(result.current).toEqual(states)
    expect(mockGetStates).toHaveBeenCalledOnce()
  })

  it('updates states when agent:states-changed event fires', async () => {
    mockGetStates.mockResolvedValue([])

    let eventCallback: ((data: { states: readonly AgentSidecarState[] }) => void) | null = null
    mockAgentStatesChanged.mockImplementation((cb) => {
      eventCallback = cb
      return unsubscribe
    })

    const { result } = renderHook(() => useAgentStates())

    // Wait for initial fetch
    await act(async () => {
      await mockGetStates.mock.results[0]?.value
    })

    expect(result.current).toEqual([])

    // Simulate event from main process
    const updatedStates = [makeState({ sessionId: 'new-sess', status: 'alive' })]

    act(() => {
      eventCallback?.({ states: updatedStates })
    })

    expect(result.current).toEqual(updatedStates)
  })

  it('cleans up subscription on unmount', async () => {
    mockGetStates.mockResolvedValue([])

    const { unmount } = renderHook(() => useAgentStates())

    await act(async () => {
      await mockGetStates.mock.results[0]?.value
    })

    unmount()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
