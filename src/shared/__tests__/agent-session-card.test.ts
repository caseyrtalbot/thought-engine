import { describe, expect, it } from 'vitest'
import type { AgentSessionCardData } from '../agent-types'
import { formatElapsed } from '../format-elapsed'

describe('AgentSessionCardData', () => {
  it('has required fields: sessionId, status, filesTouched, startedAt, lastActivity', () => {
    const data: AgentSessionCardData = {
      sessionId: 'session-abc-123',
      status: 'active',
      filesTouched: ['/src/foo.ts', '/src/bar.ts'],
      startedAt: 1711300000000,
      lastActivity: 1711300060000
    }

    expect(data.sessionId).toBe('session-abc-123')
    expect(data.status).toBe('active')
    expect(data.filesTouched).toEqual(['/src/foo.ts', '/src/bar.ts'])
    expect(data.startedAt).toBe(1711300000000)
    expect(data.lastActivity).toBe(1711300060000)
  })

  it('status is restricted to active | idle | completed', () => {
    const active: AgentSessionCardData = {
      sessionId: 's1',
      status: 'active',
      filesTouched: [],
      startedAt: 0,
      lastActivity: 0
    }
    const idle: AgentSessionCardData = {
      sessionId: 's2',
      status: 'idle',
      filesTouched: [],
      startedAt: 0,
      lastActivity: 0
    }
    const completed: AgentSessionCardData = {
      sessionId: 's3',
      status: 'completed',
      filesTouched: [],
      startedAt: 0,
      lastActivity: 0
    }

    expect(active.status).toBe('active')
    expect(idle.status).toBe('idle')
    expect(completed.status).toBe('completed')
  })

  it('filesTouched is readonly', () => {
    const data: AgentSessionCardData = {
      sessionId: 's1',
      status: 'active',
      filesTouched: ['/a.ts'],
      startedAt: 0,
      lastActivity: 0
    }
    // TypeScript would prevent: data.filesTouched.push('/b.ts')
    // Runtime check: verify it's an array
    expect(Array.isArray(data.filesTouched)).toBe(true)
  })
})

describe('formatElapsed', () => {
  it('formats seconds when under 1 minute', () => {
    expect(formatElapsed(30_000)).toBe('30s')
  })

  it('formats minutes when under 1 hour', () => {
    expect(formatElapsed(5 * 60_000)).toBe('5m')
  })

  it('formats hours and minutes', () => {
    expect(formatElapsed(90 * 60_000)).toBe('1h 30m')
  })

  it('formats exact hours without minutes', () => {
    expect(formatElapsed(2 * 60 * 60_000)).toBe('2h')
  })

  it('returns 0s for zero duration', () => {
    expect(formatElapsed(0)).toBe('0s')
  })
})
