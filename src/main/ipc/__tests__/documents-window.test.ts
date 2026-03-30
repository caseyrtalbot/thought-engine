import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  currentWindow: null as unknown,
  sent: [] as Array<{ window: unknown; event: string; data: unknown }>,
  eventCallback: null as null | ((event: { type: 'saved'; path: string }) => void)
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

vi.mock('../../services/file-service', () => ({
  FileService: class {}
}))

vi.mock('../../services/document-manager', () => ({
  DocumentManager: class {
    onEvent = vi.fn((callback: typeof state.eventCallback) => {
      state.eventCallback = callback
    })
    open = vi.fn()
    close = vi.fn()
    update = vi.fn(() => 1)
    save = vi.fn()
    saveContent = vi.fn()
    getContent = vi.fn()
  }
}))

import { registerDocumentIpc } from '../documents'

describe('registerDocumentIpc', () => {
  beforeEach(() => {
    state.currentWindow = { id: 'startup', isDestroyed: () => false, webContents: {} }
    state.sent.length = 0
    state.eventCallback = null
  })

  it('broadcasts document events to the current window after replacement', () => {
    registerDocumentIpc()

    state.currentWindow = { id: 'replacement', isDestroyed: () => false, webContents: {} }
    state.eventCallback?.({ type: 'saved', path: '/vault/notes/hello.md' })

    expect(state.sent).toEqual([
      {
        window: state.currentWindow,
        event: 'doc:saved',
        data: { type: 'saved', path: '/vault/notes/hello.md' }
      }
    ])
  })
})
