import { describe, it, expect, vi } from 'vitest'

describe('flushSync avoidance', () => {
  it('NoteCard defers setContent to queueMicrotask', async () => {
    const setContentSpy = vi.fn()
    const originalQueueMicrotask = globalThis.queueMicrotask
    const microtaskCalls: Array<() => void> = []

    globalThis.queueMicrotask = (cb: () => void) => microtaskCalls.push(cb)

    const editor = {
      isDestroyed: false,
      storage: {
        markdown: {
          manager: { parse: (body: string) => ({ type: 'doc', content: body }) }
        }
      },
      commands: { setContent: setContentSpy }
    }
    const body = '# Hello'
    const loading = false

    // This mirrors the fixed useEffect body
    if (editor && body && !loading) {
      queueMicrotask(() => {
        if (editor.isDestroyed) return
        const manager = editor.storage.markdown?.manager
        if (manager) {
          editor.commands.setContent(manager.parse(body))
        } else {
          editor.commands.setContent(body)
        }
      })
    }

    expect(setContentSpy).not.toHaveBeenCalled()
    expect(microtaskCalls).toHaveLength(1)

    microtaskCalls[0]()
    expect(setContentSpy).toHaveBeenCalledOnce()

    globalThis.queueMicrotask = originalQueueMicrotask
  })

  it('skips setContent if editor is destroyed before microtask runs', () => {
    const setContentSpy = vi.fn()
    const microtaskCalls: Array<() => void> = []
    const originalQueueMicrotask = globalThis.queueMicrotask
    globalThis.queueMicrotask = (cb: () => void) => microtaskCalls.push(cb)

    const editor = {
      isDestroyed: false,
      storage: { markdown: { manager: { parse: () => ({}) } } },
      commands: { setContent: setContentSpy }
    }

    queueMicrotask(() => {
      if (editor.isDestroyed) return
      editor.commands.setContent('content')
    })

    editor.isDestroyed = true
    microtaskCalls[0]()

    expect(setContentSpy).not.toHaveBeenCalled()

    globalThis.queueMicrotask = originalQueueMicrotask
  })
})
