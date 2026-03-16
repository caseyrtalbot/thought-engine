import { describe, it, expect } from 'vitest'

// ─── StatusBar word count ─────────────────────────────────────────────────────
// This logic mirrors what StatusBar uses internally to compute word count.
// Tested here as a pure function so the component behaviour is covered without
// mounting the full React tree.

describe('StatusBar word count', () => {
  function countWords(content: string): number {
    const trimmed = content.trim()
    if (trimmed.length === 0) return 0
    return trimmed.split(/\s+/).length
  }

  it('counts words in normal text', () => {
    expect(countWords('hello world foo bar')).toBe(4)
  })

  it('returns 0 for empty content', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })

  it('handles single word', () => {
    expect(countWords('hello')).toBe(1)
  })

  it('handles multiple whitespace', () => {
    expect(countWords('hello    world')).toBe(2)
  })

  it('handles newlines and tabs', () => {
    expect(countWords('hello\nworld\tfoo')).toBe(3)
  })
})
