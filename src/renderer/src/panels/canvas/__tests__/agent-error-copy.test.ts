import { describe, it, expect } from 'vitest'
import { agentErrorCopy } from '../agent-error-copy'

describe('agentErrorCopy', () => {
  it('returns stalled copy for stalled tag', () => {
    expect(agentErrorCopy({ error: 'anything', tag: 'stalled' })).toBe(
      'Agent stalled. Try a smaller selection.'
    )
  })

  it('returns cap copy for cap tag', () => {
    expect(agentErrorCopy({ error: 'anything', tag: 'cap' })).toBe(
      'Agent exceeded 3-minute limit. Try fewer cards.'
    )
  })

  it('returns not-found copy for not-found tag', () => {
    expect(agentErrorCopy({ error: 'anything', tag: 'not-found' })).toBe(
      "Couldn't find Claude CLI. Run `which claude` in terminal."
    )
  })

  it('returns invalid-output copy for invalid-output tag', () => {
    expect(agentErrorCopy({ error: 'parse fail', tag: 'invalid-output' })).toBe(
      'Agent returned invalid output. Try again.'
    )
  })

  it('formats cli-error with tail of message, max 140 chars', () => {
    const long = 'line1\nline2\n' + 'x'.repeat(300)
    const copy = agentErrorCopy({ error: long, tag: 'cli-error' })
    expect(copy.startsWith('Agent error: ')).toBe(true)
    expect(copy.length).toBeLessThanOrEqual('Agent error: '.length + 140)
  })

  it('falls back to raw message when no tag', () => {
    expect(agentErrorCopy({ error: 'some raw thing' })).toBe('some raw thing')
  })

  it('falls back to generic message when tag is unknown', () => {
    expect(agentErrorCopy({ error: 'raw', tag: 'mystery' as never })).toBe('raw')
  })
})
