import { beforeEach, describe, expect, it, vi } from 'vitest'

const { capturedHandlers, sentEvents } = vi.hoisted(() => ({
  capturedHandlers: new Map<string, (args: void) => Promise<void> | void>(),
  sentEvents: [] as Array<{ window: unknown; event: string; data: unknown }>
}))

vi.mock('../../typed-ipc', () => ({
  typedHandle: vi.fn((channel: string, handler: (args: void) => Promise<void> | void) => {
    capturedHandlers.set(channel, handler)
  }),
  typedSend: vi.fn((window: unknown, event: string, data: unknown) => {
    sentEvents.push({ window, event, data })
  })
}))

import { QuitCoordinator } from '../quit-coordinator'

describe('QuitCoordinator', () => {
  const window = {
    isDestroyed: () => false,
    webContents: {}
  }

  beforeEach(() => {
    capturedHandlers.clear()
    sentEvents.length = 0
    vi.useFakeTimers()
  })

  it('resolves when the renderer acknowledges quit through the invoke handler', async () => {
    const coordinator = new QuitCoordinator()
    coordinator.registerIpc()

    const waitForAck = coordinator.requestRendererFlush(() => window as never, 500)
    expect(sentEvents).toEqual([{ window, event: 'app:will-quit', data: {} }])

    await capturedHandlers.get('app:quit-ready')?.()
    await waitForAck
  })

  it('falls back after the timeout when no renderer acknowledgement arrives', async () => {
    const coordinator = new QuitCoordinator()
    coordinator.registerIpc()

    const waitForAck = coordinator.requestRendererFlush(() => window as never, 500)
    await vi.advanceTimersByTimeAsync(500)
    await waitForAck

    expect(sentEvents).toEqual([{ window, event: 'app:will-quit', data: {} }])
  })
})
