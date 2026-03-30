import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  currentWindow: null as unknown,
  sent: [] as Array<{ window: unknown; event: string; data: unknown }>,
  watchers: [] as Array<{ on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>
}))

vi.mock('../session-utils', () => ({
  toDirKey: vi.fn(() => 'project-key'),
  extractToolEvents: vi.fn(() => [])
}))

vi.mock('../session-milestone-grouper', () => ({
  groupEventsIntoMilestones: vi.fn(() => [])
}))

vi.mock('chokidar', () => ({
  watch: vi.fn(() => {
    const watcher = {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    }
    state.watchers.push(watcher)
    return watcher
  })
}))

vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
  open: vi.fn(),
  default: {
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ size: 0 }),
    open: vi.fn()
  }
}))

vi.mock('../../typed-ipc', () => ({
  typedSend: vi.fn((window: unknown, event: string, data: unknown) => {
    state.sent.push({ window, event, data })
  })
}))

import { SessionTailer } from '../session-tailer'

describe('SessionTailer', () => {
  beforeEach(() => {
    state.currentWindow = { id: 'startup', isDestroyed: () => false, webContents: {} }
    state.sent.length = 0
    state.watchers.length = 0
  })

  it('resolves the active window dynamically for later session events', async () => {
    const tailer = new SessionTailer(() => state.currentWindow as never)
    const internalTailer = tailer as unknown as {
      startTailingSession: (filePath: string) => Promise<void>
      stopTailingSession: (filePath: string) => Promise<void>
    }

    await internalTailer.startTailingSession('/tmp/session-1.jsonl')
    const replacementWindow = { id: 'replacement', isDestroyed: () => false, webContents: {} }
    state.currentWindow = replacementWindow

    await internalTailer.stopTailingSession('/tmp/session-1.jsonl')

    expect(state.sent[0]).toMatchObject({
      window: { id: 'startup' },
      event: 'session:detected',
      data: { active: true, sessionId: 'session-1' }
    })
    expect(state.sent[state.sent.length - 1]).toMatchObject({
      window: replacementWindow,
      event: 'session:detected',
      data: { active: false, sessionId: 'session-1' }
    })
  })
})
