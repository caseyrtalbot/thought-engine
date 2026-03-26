import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentSidecarState } from '../../src/shared/agent-types'

// Mock electron before any imports that use it
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

import { ipcMain } from 'electron'

const mockIpcHandle = vi.mocked(ipcMain.handle)

// Minimal BrowserWindow mock
function createMockWindow() {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
      send: vi.fn()
    }
  } as unknown as import('electron').BrowserWindow
}

describe('registerAgentIpc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers a handler for agent:get-states', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    registerAgentIpc(window, null)

    expect(mockIpcHandle).toHaveBeenCalledWith('agent:get-states', expect.any(Function))
  })

  it('agent:get-states returns empty array when monitor is null', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    registerAgentIpc(window, null)

    // Extract the registered handler from the mock
    const getStatesCall = mockIpcHandle.mock.calls.find(
      ([channel]) => channel === 'agent:get-states'
    )
    expect(getStatesCall).toBeDefined()

    const handler = getStatesCall![1]
    const result = await handler({} as never, undefined)

    expect(result).toEqual([])
  })

  it('agent:get-states delegates to monitor.getAgentStates() when monitor provided', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    const fakeStates: AgentSidecarState[] = [
      {
        sessionId: 'abc123',
        tmuxName: 'te-abc123',
        status: 'alive',
        pid: 12345,
        currentCommand: 'claude'
      }
    ]
    const mockMonitor = {
      getAgentStates: vi.fn().mockReturnValue(fakeStates),
      start: vi.fn(),
      stop: vi.fn()
    } as unknown as import('../../src/main/services/tmux-monitor').TmuxMonitor

    registerAgentIpc(window, mockMonitor)

    const getStatesCall = mockIpcHandle.mock.calls.find(
      ([channel]) => channel === 'agent:get-states'
    )
    const handler = getStatesCall![1]
    const result = await handler({} as never, undefined)

    expect(mockMonitor.getAgentStates).toHaveBeenCalledOnce()
    expect(result).toEqual(fakeStates)
  })

  it('calls monitor.start with a callback when monitor is provided', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    const mockMonitor = {
      getAgentStates: vi.fn().mockReturnValue([]),
      start: vi.fn(),
      stop: vi.fn()
    } as unknown as import('../../src/main/services/tmux-monitor').TmuxMonitor

    registerAgentIpc(window, mockMonitor)

    expect(mockMonitor.start).toHaveBeenCalledOnce()
    expect(mockMonitor.start).toHaveBeenCalledWith(expect.any(Function))
  })

  it('does not call monitor.start when monitor is null', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    // Should not throw
    registerAgentIpc(window, null)

    // No monitor to start, so nothing to assert beyond no crash
  })

  it('sends agent:states-changed event to window when monitor fires onChange', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    const fakeStates: AgentSidecarState[] = [
      {
        sessionId: 'xyz789',
        tmuxName: 'te-xyz789',
        status: 'idle',
        currentCommand: 'zsh'
      }
    ]

    let capturedCallback: ((states: AgentSidecarState[]) => void) | null = null
    const mockMonitor = {
      getAgentStates: vi.fn().mockReturnValue([]),
      start: vi.fn().mockImplementation((cb: (states: AgentSidecarState[]) => void) => {
        capturedCallback = cb
      }),
      stop: vi.fn()
    } as unknown as import('../../src/main/services/tmux-monitor').TmuxMonitor

    registerAgentIpc(window, mockMonitor)

    // Simulate monitor detecting a state change
    expect(capturedCallback).not.toBeNull()
    capturedCallback!(fakeStates)

    expect(window.webContents.send).toHaveBeenCalledWith('agent:states-changed', {
      states: fakeStates
    })
  })

  it('does not send to destroyed window', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()
    ;(window.isDestroyed as ReturnType<typeof vi.fn>).mockReturnValue(true)

    const fakeStates: AgentSidecarState[] = [
      { sessionId: 'dead1', tmuxName: 'te-dead1', status: 'alive' }
    ]

    let capturedCallback: ((states: AgentSidecarState[]) => void) | null = null
    const mockMonitor = {
      getAgentStates: vi.fn().mockReturnValue([]),
      start: vi.fn().mockImplementation((cb: (states: AgentSidecarState[]) => void) => {
        capturedCallback = cb
      }),
      stop: vi.fn()
    } as unknown as import('../../src/main/services/tmux-monitor').TmuxMonitor

    registerAgentIpc(window, mockMonitor)
    capturedCallback!(fakeStates)

    // typedSend checks isDestroyed and skips the send
    expect(window.webContents.send).not.toHaveBeenCalled()
  })

  it('registers a handler for agent:spawn', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    const mockSpawner = {
      spawn: vi.fn().mockReturnValue('test-session-id')
    } as unknown as import('../../src/main/services/agent-spawner').AgentSpawner

    registerAgentIpc(window, null, mockSpawner)

    expect(mockIpcHandle).toHaveBeenCalledWith('agent:spawn', expect.any(Function))
  })

  it('agent:spawn calls spawner and returns sessionId', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    const mockSpawner = {
      spawn: vi.fn().mockReturnValue('spawned-session-123')
    } as unknown as import('../../src/main/services/agent-spawner').AgentSpawner

    registerAgentIpc(window, null, mockSpawner)

    const spawnCall = mockIpcHandle.mock.calls.find(([channel]) => channel === 'agent:spawn')
    expect(spawnCall).toBeDefined()

    const handler = spawnCall![1]
    const result = await handler({} as never, { cwd: '/test/dir', prompt: 'do stuff' })

    expect(mockSpawner.spawn).toHaveBeenCalledWith({ cwd: '/test/dir', prompt: 'do stuff' })
    expect(result).toEqual({ sessionId: 'spawned-session-123' })
  })

  it('agent:spawn returns error when spawner is null', async () => {
    const { registerAgentIpc } = await import('../../src/main/ipc/agents')
    const window = createMockWindow()

    registerAgentIpc(window, null, null)

    const spawnCall = mockIpcHandle.mock.calls.find(([channel]) => channel === 'agent:spawn')
    expect(spawnCall).toBeDefined()

    const handler = spawnCall![1]
    const result = await handler({} as never, { cwd: '/test/dir' })

    expect(result).toEqual({ error: 'Agent spawner not available' })
  })
})
