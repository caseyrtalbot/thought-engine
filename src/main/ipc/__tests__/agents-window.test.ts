import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAgentIpc, setAgentServices, stopAgentServices } from '../agents'

const state = vi.hoisted(() => ({
  currentWindow: null as unknown,
  sent: [] as Array<{ window: unknown; event: string; data: unknown }>,
  monitorCallback: null as null | ((states: readonly { id: string }[]) => void)
}))

vi.mock('../../typed-ipc', () => ({
  typedHandle: vi.fn(),
  typedSend: vi.fn((window: unknown, event: string, data: unknown) => {
    state.sent.push({ window, event, data })
  })
}))

vi.mock('../../window-registry', () => ({
  getMainWindow: () => state.currentWindow
}))

describe('registerAgentIpc', () => {
  beforeEach(() => {
    state.currentWindow = { id: 'startup', isDestroyed: () => false, webContents: {} }
    state.sent.length = 0
    state.monitorCallback = null
    stopAgentServices()
  })

  it('sends agent state updates to the current window after replacement', () => {
    registerAgentIpc()

    setAgentServices(
      {
        stop: vi.fn(),
        start: vi.fn((callback: typeof state.monitorCallback) => {
          state.monitorCallback = callback
        }),
        getAgentStates: vi.fn().mockReturnValue([])
      } as never,
      {
        spawn: vi.fn()
      } as never
    )

    state.currentWindow = { id: 'replacement', isDestroyed: () => false, webContents: {} }
    state.monitorCallback?.([{ id: 'agent-1' }])

    expect(state.sent).toEqual([
      {
        window: state.currentWindow,
        event: 'agent:states-changed',
        data: { states: [{ id: 'agent-1' }] }
      }
    ])
  })
})
