import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  appWillQuitHandler: null as null | (() => Promise<void>),
  flushCanvasPromise: Promise.resolve(),
  flushPendingPromise: Promise.resolve()
}))

vi.mock('../canvas-autosave', () => ({
  flushCanvasSave: vi.fn(() => state.flushCanvasPromise)
}))

vi.mock('../editor-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor-store')>()
  return {
    ...actual,
    flushPendingSave: vi.fn(() => state.flushPendingPromise)
  }
})

import { registerQuitHandler } from '../vault-persist'
import { useEditorStore } from '../editor-store'
import { useVaultStore } from '../vault-store'
import { useViewStore } from '../view-store'

function deferredPromise() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('registerQuitHandler', () => {
  beforeEach(() => {
    state.appWillQuitHandler = null
    state.flushCanvasPromise = Promise.resolve()
    state.flushPendingPromise = Promise.resolve()

    const writeState = vi.fn(() => Promise.resolve())
    const quitReady = vi.fn()

    window.api = {
      vault: {
        writeState
      },
      lifecycle: {
        quitReady
      },
      on: {
        appWillQuit: vi.fn((handler: () => Promise<void>) => {
          state.appWillQuitHandler = handler
          return vi.fn()
        })
      }
    } as never

    useVaultStore.setState({
      vaultPath: '/vault',
      state: {
        version: 1,
        lastOpenNote: null,
        panelLayout: { sidebarWidth: 280, terminalWidth: 360 },
        contentView: 'editor',
        terminalSessions: [],
        fileTreeCollapseState: {},
        selectedNodeId: null,
        recentFiles: []
      }
    })

    useEditorStore.setState({
      activeNotePath: '/vault/notes/hello.md',
      mode: 'rich',
      isDirty: false,
      content: '# Hello',
      cursorLine: 1,
      cursorCol: 1,
      openTabs: [],
      historyStack: [],
      historyIndex: -1
    })

    useViewStore.setState({ contentView: 'editor' })
  })

  it('waits for every flush before sending quitReady', async () => {
    const writeStateDeferred = deferredPromise()
    const flushCanvasDeferred = deferredPromise()
    const flushPendingDeferred = deferredPromise()

    window.api.vault.writeState = vi.fn(() => writeStateDeferred.promise)
    state.flushCanvasPromise = flushCanvasDeferred.promise
    state.flushPendingPromise = flushPendingDeferred.promise

    registerQuitHandler()

    const quitPromise = state.appWillQuitHandler?.()
    expect(window.api.lifecycle.quitReady).not.toHaveBeenCalled()

    writeStateDeferred.resolve()
    await Promise.resolve()
    expect(window.api.lifecycle.quitReady).not.toHaveBeenCalled()

    flushCanvasDeferred.resolve()
    await Promise.resolve()
    expect(window.api.lifecycle.quitReady).not.toHaveBeenCalled()

    flushPendingDeferred.resolve()
    await quitPromise

    expect(window.api.lifecycle.quitReady).toHaveBeenCalledTimes(1)
  })
})
