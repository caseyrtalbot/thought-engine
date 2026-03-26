import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { AgentSidecarState, AgentSidecar } from '../../src/shared/agent-types'

// Mock tmux-paths before importing TmuxMonitor
vi.mock('../../src/main/services/tmux-paths', () => ({
  tmuxExec: vi.fn(),
  SESSION_PREFIX: 'te-',
  readSessionMeta: vi.fn(),
  verifyTmuxAvailable: vi.fn()
}))

// Mock @electron-toolkit/utils (required by tmux-paths at module level)
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import { TmuxMonitor } from '../../src/main/services/tmux-monitor'
import { tmuxExec, readSessionMeta, verifyTmuxAvailable } from '../../src/main/services/tmux-paths'

const mockTmuxExec = vi.mocked(tmuxExec)
const mockReadSessionMeta = vi.mocked(readSessionMeta)
const mockVerifyTmuxAvailable = vi.mocked(verifyTmuxAvailable)

// Real temp directory for sidecar file tests
let tmpVaultRoot: string

describe('AgentSidecarState schema', () => {
  it('has required fields with correct types', () => {
    const state: AgentSidecarState = {
      sessionId: 'abc123',
      tmuxName: 'te-abc123',
      status: 'alive'
    }
    expect(state.sessionId).toBe('abc123')
    expect(state.tmuxName).toBe('te-abc123')
    expect(state.status).toBe('alive')
  })

  it('supports all optional fields', () => {
    const state: AgentSidecarState = {
      sessionId: 'abc123',
      tmuxName: 'te-abc123',
      status: 'idle',
      pid: 12345,
      currentCommand: 'zsh',
      startedAt: '2026-03-25T00:00:00.000Z',
      lastActivity: '2026-03-25T00:01:00.000Z',
      label: 'Agent 1',
      cwd: '/Users/test/vault',
      sidecar: {
        filesTouched: ['file1.md', 'file2.md'],
        currentTask: 'writing tests',
        agentType: 'claude-code'
      }
    }
    expect(state.pid).toBe(12345)
    expect(state.currentCommand).toBe('zsh')
    expect(state.sidecar?.filesTouched).toEqual(['file1.md', 'file2.md'])
    expect(state.sidecar?.currentTask).toBe('writing tests')
    expect(state.sidecar?.agentType).toBe('claude-code')
  })

  it('allows all three status values', () => {
    const statuses: AgentSidecarState['status'][] = ['alive', 'idle', 'exited']
    expect(statuses).toHaveLength(3)
  })

  it('AgentSidecar filesTouched is readonly array', () => {
    const sidecar: AgentSidecar = {
      filesTouched: ['a.md']
    }
    expect(sidecar.filesTouched).toEqual(['a.md'])
  })
})

describe('TmuxMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tmpVaultRoot = join(tmpdir(), `tmux-monitor-test-${randomUUID()}`)
  })

  afterEach(() => {
    rmSync(tmpVaultRoot, { recursive: true, force: true })
  })

  describe('getAgentStates', () => {
    it('returns empty array when no tmux sessions exist', () => {
      mockTmuxExec.mockImplementation(() => {
        throw new Error('no server running')
      })

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()
      expect(states).toEqual([])
    })

    it('returns empty array when tmux has sessions but none with te- prefix', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'other-session\nrandom-name'
        return ''
      })

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()
      expect(states).toEqual([])
    })

    it('returns session state for te- prefixed sessions', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-abc123\nother-session'
        if (args[0] === 'list-panes') return '12345 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states).toHaveLength(1)
      expect(states[0].sessionId).toBe('abc123')
      expect(states[0].tmuxName).toBe('te-abc123')
      expect(states[0].status).toBe('alive')
    })

    it('includes pane PID and current command', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-xyz789'
        if (args[0] === 'list-panes') return '99887 claude'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].pid).toBe(99887)
      expect(states[0].currentCommand).toBe('claude')
    })

    it('includes session metadata (startedAt, label, cwd)', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-meta1'
        if (args[0] === 'list-panes') return '555 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue({
        shell: '/bin/zsh',
        cwd: '/Users/test/project',
        createdAt: '2026-03-25T10:00:00.000Z',
        label: 'Research Agent'
      })

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].startedAt).toBe('2026-03-25T10:00:00.000Z')
      expect(states[0].label).toBe('Research Agent')
      expect(states[0].cwd).toBe('/Users/test/project')
    })

    it('handles missing metadata gracefully', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-nometa'
        if (args[0] === 'list-panes') return '555 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states).toHaveLength(1)
      expect(states[0].startedAt).toBeUndefined()
      expect(states[0].label).toBeUndefined()
      expect(states[0].cwd).toBeUndefined()
    })

    it('handles pane info failure gracefully', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-broken'
        if (args[0] === 'list-panes') throw new Error('pane gone')
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states).toHaveLength(1)
      expect(states[0].pid).toBeUndefined()
      expect(states[0].currentCommand).toBeUndefined()
    })

    it('reads sidecar file when present', () => {
      // Write a real sidecar file to the temp vault root
      const sidecarDir = join(tmpVaultRoot, '.te', 'agents')
      mkdirSync(sidecarDir, { recursive: true })
      const sidecarData = {
        filesTouched: ['README.md', 'src/index.ts'],
        currentTask: 'implementing feature',
        agentType: 'claude-code'
      }
      writeFileSync(join(sidecarDir, 'side1.json'), JSON.stringify(sidecarData), 'utf-8')

      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-side1'
        if (args[0] === 'list-panes') return '111 claude'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].sidecar).toEqual(sidecarData)
    })

    it('handles missing sidecar dir gracefully', () => {
      // No .te/agents directory exists at tmpVaultRoot
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-nosidecar'
        if (args[0] === 'list-panes') return '222 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states).toHaveLength(1)
      expect(states[0].sidecar).toBeUndefined()
    })

    it('detects idle status when pane command is a shell (zsh)', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-idle1'
        if (args[0] === 'list-panes') return '444 zsh'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].status).toBe('idle')
    })

    it('detects idle status when pane command is bash', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-idle2'
        if (args[0] === 'list-panes') return '555 bash'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].status).toBe('idle')
    })

    it('detects idle status when pane command is fish', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-idle3'
        if (args[0] === 'list-panes') return '666 fish'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].status).toBe('idle')
    })

    it('detects alive status when pane command is not a shell', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-alive1'
        if (args[0] === 'list-panes') return '777 claude'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].status).toBe('alive')
    })

    it('detects idle when shell has -zsh or -bash prefix', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-loginshell'
        if (args[0] === 'list-panes') return '888 -zsh'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states[0].status).toBe('idle')
    })

    it('handles corrupt sidecar JSON gracefully', () => {
      const sidecarDir = join(tmpVaultRoot, '.te', 'agents')
      mkdirSync(sidecarDir, { recursive: true })
      writeFileSync(join(sidecarDir, 'corrupt1.json'), '{not valid json!!!', 'utf-8')

      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-corrupt1'
        if (args[0] === 'list-panes') return '333 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states).toHaveLength(1)
      expect(states[0].sidecar).toBeUndefined()
      expect(states[0].sessionId).toBe('corrupt1')
    })
  })

  describe('start/stop polling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('calls onChange on first poll with current states', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-poll1'
        if (args[0] === 'list-panes') return '100 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const onChange = vi.fn()
      const monitor = new TmuxMonitor(tmpVaultRoot, 1000)
      monitor.start(onChange)

      // First poll fires immediately
      vi.advanceTimersByTime(0)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toHaveLength(1)
      expect(onChange.mock.calls[0][0][0].sessionId).toBe('poll1')

      monitor.stop()
    })

    it('stop prevents further onChange calls', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-stop1'
        if (args[0] === 'list-panes') return '200 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const onChange = vi.fn()
      const monitor = new TmuxMonitor(tmpVaultRoot, 500)
      monitor.start(onChange)

      vi.advanceTimersByTime(0) // first poll
      expect(onChange).toHaveBeenCalledTimes(1)

      monitor.stop()

      vi.advanceTimersByTime(2000) // should not fire again
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('does not call onChange when state has not changed between polls', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-stable1'
        if (args[0] === 'list-panes') return '300 node'
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const onChange = vi.fn()
      const monitor = new TmuxMonitor(tmpVaultRoot, 1000)
      monitor.start(onChange)

      // First poll fires immediately
      expect(onChange).toHaveBeenCalledTimes(1)

      // Advance past several intervals with same state
      vi.advanceTimersByTime(3000)

      // Should still be 1 because state hasn't changed
      expect(onChange).toHaveBeenCalledTimes(1)

      monitor.stop()
    })

    it('calls onChange when state changes between polls', () => {
      let callCount = 0
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-changing1'
        if (args[0] === 'list-panes') {
          callCount++
          // First call: running node. Subsequent calls: idle in zsh.
          return callCount <= 1 ? '400 node' : '400 zsh'
        }
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const onChange = vi.fn()
      const monitor = new TmuxMonitor(tmpVaultRoot, 1000)
      monitor.start(onChange)

      // First poll: alive with node
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0][0].status).toBe('alive')

      // Advance one interval: state changes to idle
      vi.advanceTimersByTime(1000)
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange.mock.calls[1][0][0].status).toBe('idle')

      // Advance another interval: same idle state, should not fire
      vi.advanceTimersByTime(1000)
      expect(onChange).toHaveBeenCalledTimes(2)

      monitor.stop()
    })
  })

  describe('multiple sessions', () => {
    it('returns states for multiple te- sessions', () => {
      mockTmuxExec.mockImplementation((...args: string[]) => {
        if (args[0] === 'list-sessions') return 'te-first\nte-second\nother'
        if (args[0] === 'list-panes' && args[1] === '-t' && args[2] === 'te-first') {
          return '100 claude'
        }
        if (args[0] === 'list-panes' && args[1] === '-t' && args[2] === 'te-second') {
          return '200 zsh'
        }
        return ''
      })
      mockReadSessionMeta.mockReturnValue(null)

      const monitor = new TmuxMonitor(tmpVaultRoot)
      const states = monitor.getAgentStates()

      expect(states).toHaveLength(2)
      expect(states[0].sessionId).toBe('first')
      expect(states[0].status).toBe('alive')
      expect(states[1].sessionId).toBe('second')
      expect(states[1].status).toBe('idle')
    })
  })

  describe('tryCreate', () => {
    it('returns null when tmux is not available', () => {
      mockVerifyTmuxAvailable.mockReturnValue(false)
      const monitor = TmuxMonitor.tryCreate(tmpVaultRoot)
      expect(monitor).toBeNull()
    })

    it('returns TmuxMonitor instance when tmux is available', () => {
      mockVerifyTmuxAvailable.mockReturnValue(true)
      const monitor = TmuxMonitor.tryCreate(tmpVaultRoot)
      expect(monitor).toBeInstanceOf(TmuxMonitor)
    })
  })
})
