import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  currentWindow: null as unknown,
  sent: [] as Array<{ window: unknown; event: string; data: unknown }>,
  handlers: new Map<string, (args: { vaultPath: string }) => Promise<void>>(),
  watcherCallback: null as
    | null
    | ((events: Array<{ path: string; event: 'add' | 'change' | 'unlink' }>) => void)
}))

vi.mock('../../typed-ipc', () => ({
  typedHandle: vi.fn((channel: string, handler: (args: { vaultPath: string }) => Promise<void>) => {
    state.handlers.set(channel, handler)
  }),
  typedSend: vi.fn((window: unknown, event: string, data: unknown) => {
    state.sent.push({ window, event, data })
  })
}))

vi.mock('../../window-registry', () => ({
  getMainWindow: () => state.currentWindow
}))

vi.mock('../../services/vault-watcher', () => ({
  VaultWatcher: class {
    start = vi.fn(async (_vaultPath: string, callback: typeof state.watcherCallback) => {
      state.watcherCallback = callback
    })
    stop = vi.fn()
  }
}))

vi.mock('../../services/file-service', () => ({
  FileService: class {
    readFile = vi.fn().mockRejectedValue(new Error('missing config'))
  }
}))

vi.mock('../documents', () => ({
  getDocumentManager: () => ({
    documents: new Map<string, unknown>(),
    handleExternalChange: vi.fn().mockResolvedValue(undefined)
  })
}))

import { registerWatcherIpc } from '../watcher'

describe('registerWatcherIpc', () => {
  beforeEach(() => {
    state.currentWindow = { id: 'startup', isDestroyed: () => false, webContents: {} }
    state.sent.length = 0
    state.handlers.clear()
    state.watcherCallback = null
  })

  it('sends file change batches to the current window after window replacement', async () => {
    registerWatcherIpc()
    await state.handlers.get('vault:watch-start')?.({ vaultPath: '/vault' })

    state.currentWindow = { id: 'replacement', isDestroyed: () => false, webContents: {} }
    state.watcherCallback?.([{ path: '/vault/notes/hello.md', event: 'change' }])

    expect(state.sent).toEqual([
      {
        window: state.currentWindow,
        event: 'vault:files-changed-batch',
        data: { events: [{ path: '/vault/notes/hello.md', event: 'change' }] }
      }
    ])
  })
})
