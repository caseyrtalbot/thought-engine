import { describe, it, expect } from 'vitest'
import { toDirKey, extractToolEvents } from '../../src/main/services/session-utils'

describe('toDirKey', () => {
  it('replaces slashes with dashes', () => {
    expect(toDirKey('/Users/casey/Projects/my-app')).toBe('-Users-casey-Projects-my-app')
  })

  it('handles root path', () => {
    expect(toDirKey('/')).toBe('-')
  })
})

describe('extractToolEvents', () => {
  it('extracts Read tool_use from assistant message', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-03-18T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Read',
            input: { file_path: '/Users/casey/Projects/my-app/src/index.ts' }
          }
        ]
      }
    })

    const events = extractToolEvents(line)
    expect(events).toHaveLength(1)
    expect(events[0].tool).toBe('Read')
    expect(events[0].filePath).toBe('/Users/casey/Projects/my-app/src/index.ts')
  })

  it('extracts Edit tool_use with detail truncated to 200 chars', () => {
    const longString = 'x'.repeat(300)
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-03-18T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Edit',
            input: { file_path: '/src/app.ts', new_string: longString }
          }
        ]
      }
    })

    const events = extractToolEvents(line)
    expect(events).toHaveLength(1)
    expect(events[0].tool).toBe('Edit')
    expect(events[0].detail).toBe('x'.repeat(200))
    expect(events[0].detail?.length).toBe(200)
  })

  it('extracts Bash tool_use with command detail truncated to 100 chars', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-03-18T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Bash',
            input: { command: 'npm test' }
          }
        ]
      }
    })

    const events = extractToolEvents(line)
    expect(events).toHaveLength(1)
    expect(events[0].tool).toBe('Bash')
    expect(events[0].detail).toBe('npm test')
  })

  it('returns empty array for non-assistant messages', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'hello' }
    })

    expect(extractToolEvents(line)).toEqual([])
  })

  it('returns empty array for malformed JSON', () => {
    expect(extractToolEvents('this is not valid json')).toEqual([])
  })

  it('extracts multiple tool_use blocks from one message', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-03-18T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Read',
            input: { file_path: '/src/a.ts' }
          },
          {
            type: 'tool_use',
            name: 'Edit',
            input: { file_path: '/src/b.ts', new_string: 'updated content' }
          }
        ]
      }
    })

    const events = extractToolEvents(line)
    expect(events).toHaveLength(2)
    expect(events[0].tool).toBe('Read')
    expect(events[1].tool).toBe('Edit')
  })

  it('extracts Grep tool_use with path from input.path (not file_path)', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-03-18T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Grep',
            input: { pattern: 'useState', path: '/Users/casey/Projects/my-app/src' }
          }
        ]
      }
    })

    const events = extractToolEvents(line)
    expect(events).toHaveLength(1)
    expect(events[0].tool).toBe('Grep')
    expect(events[0].filePath).toBe('/Users/casey/Projects/my-app/src')
  })

  it('skips text blocks and only extracts tool_use blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-03-18T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will read this file for you.' },
          {
            type: 'tool_use',
            name: 'Read',
            input: { file_path: '/src/index.ts' }
          }
        ]
      }
    })

    const events = extractToolEvents(line)
    expect(events).toHaveLength(1)
    expect(events[0].tool).toBe('Read')
  })

  it('includes timestamp from the JSONL entry', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-03-18T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Bash',
            input: { command: 'npm run build' }
          }
        ]
      }
    })

    const events = extractToolEvents(line)
    expect(events).toHaveLength(1)
    expect(events[0].timestamp).toBe(new Date('2026-03-18T10:00:00Z').getTime())
  })
})
