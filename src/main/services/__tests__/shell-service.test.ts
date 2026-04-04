// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn()
}))

vi.mock('node-pty', () => ({
  spawn: mockSpawn
}))

vi.mock('../session-paths', () => ({
  getTerminfoDir: vi.fn(() => undefined),
  writeSessionMeta: vi.fn(),
  readSessionMeta: vi.fn(() => null),
  deleteSessionMeta: vi.fn(),
  ensureSessionDir: vi.fn(),
  getSessionDir: vi.fn(() => '/tmp/test-sessions')
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, readdirSync: vi.fn(() => []) }
})

import { ShellService } from '../shell-service'

function makePty() {
  return {
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
    process: '/bin/zsh'
  }
}

describe('ShellService', () => {
  beforeEach(() => {
    mockSpawn.mockReset()
    mockSpawn.mockReturnValue(makePty())
  })

  it('passes requested cols and rows to sessions', () => {
    const service = new ShellService()

    service.create('/tmp/project', 132, 44, '/bin/zsh')

    expect(mockSpawn).toHaveBeenCalledWith(
      '/bin/zsh',
      [],
      expect.objectContaining({
        cwd: '/tmp/project',
        cols: 132,
        rows: 44
      })
    )
  })

  it('defaults sessions to 80x24 only when no geometry is provided', () => {
    const service = new ShellService()

    service.create('/tmp/project')

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        cwd: '/tmp/project',
        cols: 80,
        rows: 24
      })
    )
  })

  it('exposes PtyService for monitoring', () => {
    const service = new ShellService()
    expect(service.getPtyService()).toBeDefined()
  })
})
