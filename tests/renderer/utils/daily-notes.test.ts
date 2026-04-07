import { describe, test, expect } from 'vitest'
import {
  dailyNotePath,
  todayNotePath,
  findAdjacentDailyNotes,
  extractDailyNoteDates
} from '../../../src/renderer/src/utils/daily-notes'

const VAULT = '/Users/test/vault'
const FOLDER = 'daily'

describe('dailyNotePath', () => {
  test('generates correct path for a date', () => {
    const date = new Date('2026-04-06T12:00:00Z')
    expect(dailyNotePath(VAULT, FOLDER, date)).toBe('/Users/test/vault/daily/2026-04-06.md')
  })
})

describe('todayNotePath', () => {
  test('returns path with today date', () => {
    const path = todayNotePath(VAULT, FOLDER)
    const today = new Date().toISOString().slice(0, 10)
    expect(path).toBe(`/Users/test/vault/daily/${today}.md`)
  })
})

describe('extractDailyNoteDates', () => {
  test('extracts dates from file paths', () => {
    const files = [
      { path: '/Users/test/vault/daily/2026-04-01.md' },
      { path: '/Users/test/vault/daily/2026-04-05.md' },
      { path: '/Users/test/vault/daily/not-a-date.md' },
      { path: '/Users/test/vault/other/2026-04-06.md' }
    ]
    const dates = extractDailyNoteDates(files, VAULT, FOLDER)
    expect(dates.has('2026-04-01')).toBe(true)
    expect(dates.has('2026-04-05')).toBe(true)
    expect(dates.has('not-a-date')).toBe(false)
    expect(dates.has('2026-04-06')).toBe(false) // wrong folder
  })

  test('returns empty set for no matching files', () => {
    const dates = extractDailyNoteDates([], VAULT, FOLDER)
    expect(dates.size).toBe(0)
  })
})

describe('findAdjacentDailyNotes', () => {
  const existing = new Set([
    '/Users/test/vault/daily/2026-04-01.md',
    '/Users/test/vault/daily/2026-04-03.md',
    '/Users/test/vault/daily/2026-04-10.md'
  ])

  test('finds previous daily note', () => {
    const current = new Date('2026-04-05T12:00:00Z')
    const { prev } = findAdjacentDailyNotes(existing, VAULT, FOLDER, current)
    expect(prev).toBe('/Users/test/vault/daily/2026-04-03.md')
  })

  test('finds next daily note', () => {
    const current = new Date('2026-04-05T12:00:00Z')
    const { next } = findAdjacentDailyNotes(existing, VAULT, FOLDER, current)
    expect(next).toBe('/Users/test/vault/daily/2026-04-10.md')
  })

  test('returns null when no adjacent notes exist', () => {
    const empty = new Set<string>()
    const current = new Date('2026-04-05T12:00:00Z')
    const { prev, next } = findAdjacentDailyNotes(empty, VAULT, FOLDER, current)
    expect(prev).toBeNull()
    expect(next).toBeNull()
  })
})
