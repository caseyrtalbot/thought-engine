import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSpawn, mockTryCreate } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockTryCreate: vi.fn(() => null)
}))

vi.mock('node-pty', () => ({
  spawn: mockSpawn
}))

vi.mock('../tmux-service', () => ({
  TmuxService: {
    tryCreate: mockTryCreate
  }
}))

import { ShellService } from '../shell-service'

function makePty() {
  return {
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    process: '/bin/zsh'
  }
}

describe('ShellService ephemeral sessions', () => {
  beforeEach(() => {
    mockTryCreate.mockReturnValue(null)
    mockSpawn.mockReset()
    mockSpawn.mockReturnValue(makePty())
  })

  it('passes requested cols and rows to non-tmux sessions', () => {
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

  it('defaults non-tmux sessions to 80x24 only when no geometry is provided', () => {
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
})
