import { describe, expect, it } from 'vitest'
import { sessionIdFromFile } from '../main/services/session-tailer'
import { groupEventsIntoMilestones } from '../main/services/session-milestone-grouper'
import type { SessionToolEvent } from '@shared/workbench-types'

describe('sessionIdFromFile', () => {
  it('strips .jsonl extension from bare filename', () => {
    expect(sessionIdFromFile('abc123.jsonl')).toBe('abc123')
  })

  it('strips .jsonl extension from full path', () => {
    expect(sessionIdFromFile('/home/user/.claude/projects/-foo/abc123.jsonl')).toBe('abc123')
  })

  it('returns same id for the same file (stability)', () => {
    const path = '/home/user/.claude/projects/-Users-me-project/session-uuid-1234.jsonl'
    const first = sessionIdFromFile(path)
    const second = sessionIdFromFile(path)
    expect(first).toBe(second)
  })

  it('returns different ids for different files', () => {
    const a = sessionIdFromFile('/dir/session-a.jsonl')
    const b = sessionIdFromFile('/dir/session-b.jsonl')
    expect(a).not.toBe(b)
  })

  it('handles UUID-style filenames', () => {
    const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    expect(sessionIdFromFile(`${uuid}.jsonl`)).toBe(uuid)
  })

  it('handles filenames with dots before .jsonl', () => {
    expect(sessionIdFromFile('session.2026.03.25.jsonl')).toBe('session.2026.03.25')
  })
})

describe('groupEventsIntoMilestones with sessionId', () => {
  const SESSION_A = 'session-aaa'
  const SESSION_B = 'session-bbb'

  const readEvent: SessionToolEvent = {
    tool: 'Read',
    timestamp: 1000,
    filePath: '/src/app.ts'
  }

  const editEvent: SessionToolEvent = {
    tool: 'Edit',
    timestamp: 2000,
    filePath: '/src/app.ts',
    detail: 'const x = 1'
  }

  const bashEvent: SessionToolEvent = {
    tool: 'Bash',
    timestamp: 3000,
    detail: 'npm test'
  }

  const writeEvent: SessionToolEvent = {
    tool: 'Write',
    timestamp: 4000,
    filePath: '/src/new-file.ts'
  }

  it('attaches sessionId to every milestone', () => {
    const milestones = groupEventsIntoMilestones([readEvent, editEvent, bashEvent], SESSION_A)

    expect(milestones.length).toBeGreaterThan(0)
    for (const m of milestones) {
      expect(m.sessionId).toBe(SESSION_A)
    }
  })

  it('different sessions produce milestones with different sessionIds', () => {
    const milestonesA = groupEventsIntoMilestones([readEvent, editEvent], SESSION_A)
    const milestonesB = groupEventsIntoMilestones([readEvent, editEvent], SESSION_B)

    for (const m of milestonesA) {
      expect(m.sessionId).toBe(SESSION_A)
    }
    for (const m of milestonesB) {
      expect(m.sessionId).toBe(SESSION_B)
    }
  })

  it('sessionId propagates through all milestone types', () => {
    const milestones = groupEventsIntoMilestones(
      [readEvent, editEvent, bashEvent, writeEvent],
      SESSION_A
    )

    // Should produce: research, edit, command, create
    expect(milestones).toHaveLength(4)

    const types = milestones.map((m) => m.type)
    expect(types).toContain('research')
    expect(types).toContain('edit')
    expect(types).toContain('command')
    expect(types).toContain('create')

    for (const m of milestones) {
      expect(m.sessionId).toBe(SESSION_A)
    }
  })

  it('returns empty array for no events', () => {
    const milestones = groupEventsIntoMilestones([], SESSION_A)
    expect(milestones).toEqual([])
  })

  it('each milestone has a unique id', () => {
    const milestones = groupEventsIntoMilestones(
      [readEvent, editEvent, bashEvent, writeEvent],
      SESSION_A
    )

    const ids = milestones.map((m) => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

describe('multi-session identity contract', () => {
  it('concurrent sessions produce independent milestone sets', () => {
    const sessionAEvents: SessionToolEvent[] = [
      { tool: 'Read', timestamp: 1000, filePath: '/src/a.ts' },
      { tool: 'Edit', timestamp: 2000, filePath: '/src/a.ts' }
    ]

    const sessionBEvents: SessionToolEvent[] = [
      { tool: 'Bash', timestamp: 1500, detail: 'npm test' },
      { tool: 'Write', timestamp: 2500, filePath: '/src/b.ts' }
    ]

    const milestonesA = groupEventsIntoMilestones(sessionAEvents, 'session-alpha')
    const milestonesB = groupEventsIntoMilestones(sessionBEvents, 'session-beta')

    // Session A: research + edit
    expect(milestonesA).toHaveLength(2)
    expect(milestonesA[0].sessionId).toBe('session-alpha')
    expect(milestonesA[1].sessionId).toBe('session-alpha')
    expect(milestonesA[0].type).toBe('research')
    expect(milestonesA[1].type).toBe('edit')

    // Session B: command + create
    expect(milestonesB).toHaveLength(2)
    expect(milestonesB[0].sessionId).toBe('session-beta')
    expect(milestonesB[1].sessionId).toBe('session-beta')
    expect(milestonesB[0].type).toBe('command')
    expect(milestonesB[1].type).toBe('create')
  })

  it('sessionId derivation matches ProjectSessionParser convention', () => {
    // ProjectSessionParser uses: file.replace('.jsonl', '')
    // sessionIdFromFile uses: basename(filePath, '.jsonl')
    // Both should produce the same result for bare filenames
    const filename = 'f47ac10b-58cc-4372-a567-0e02b2c3d479.jsonl'
    const expected = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

    expect(sessionIdFromFile(filename)).toBe(expected)
    expect(filename.replace('.jsonl', '')).toBe(expected)
  })

  it('sessionId is deterministic for the same file path', () => {
    const path = '/Users/test/.claude/projects/-Users-test-myproject/abc-def-123.jsonl'
    const results = Array.from({ length: 10 }, () => sessionIdFromFile(path))
    const unique = new Set(results)
    expect(unique.size).toBe(1)
  })
})
