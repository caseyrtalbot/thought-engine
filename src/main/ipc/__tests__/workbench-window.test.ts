import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  currentWindow: null as unknown,
  sent: [] as Array<{ window: unknown; event: string; data: unknown }>,
  handlers: new Map<string, (args: { projectPath: string }) => Promise<void>>(),
  workbenchCallback: null as null | ((event: { path: string; type: string }) => void),
  tailerGetter: null as null | (() => unknown)
}))

vi.mock('../../typed-ipc', () => ({
  typedHandle: vi.fn(
    (channel: string, handler: (args: { projectPath: string }) => Promise<void>) => {
      state.handlers.set(channel, handler)
    }
  ),
  typedSend: vi.fn((window: unknown, event: string, data: unknown) => {
    state.sent.push({ window, event, data })
  })
}))

vi.mock('../../window-registry', () => ({
  getMainWindow: () => state.currentWindow
}))

vi.mock('../../services/project-watcher', () => ({
  ProjectWatcher: class {
    start = vi.fn(async (_projectPath: string, callback: typeof state.workbenchCallback) => {
      state.workbenchCallback = callback
    })
    stop = vi.fn()
  }
}))

vi.mock('../../services/project-session-parser', () => ({
  ProjectSessionParser: class {
    parse = vi.fn().mockReturnValue([])
  }
}))

vi.mock('../../services/session-tailer', () => ({
  SessionTailer: class {
    constructor(getWindow: typeof state.tailerGetter) {
      state.tailerGetter = getWindow
    }
    start = vi.fn()
    stop = vi.fn()
  }
}))

import { registerProjectIpc } from '../workbench'

describe('registerProjectIpc', () => {
  beforeEach(() => {
    state.currentWindow = { id: 'startup', isDestroyed: () => false, webContents: {} }
    state.sent.length = 0
    state.handlers.clear()
    state.workbenchCallback = null
    state.tailerGetter = null
  })

  it('sends workbench file events to the current window after replacement', async () => {
    registerProjectIpc()
    await state.handlers.get('workbench:watch-start')?.({ projectPath: '/project' })

    state.currentWindow = { id: 'replacement', isDestroyed: () => false, webContents: {} }
    state.workbenchCallback?.({ path: '/project/file.ts', type: 'change' })

    expect(state.sent).toEqual([
      {
        window: state.currentWindow,
        event: 'workbench:file-changed',
        data: { path: '/project/file.ts', type: 'change' }
      }
    ])
  })

  it('constructs the session tailer with a live window getter', () => {
    registerProjectIpc()
    const replacementWindow = { id: 'replacement', isDestroyed: () => false, webContents: {} }
    state.currentWindow = replacementWindow

    expect(state.tailerGetter?.()).toBe(replacementWindow)
  })
})
