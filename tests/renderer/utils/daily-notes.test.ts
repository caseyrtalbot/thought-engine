import { describe, test, expect } from 'vitest'
import {
  createOrOpenDailyNote,
  dailyNotePath,
  todayNotePath,
  localDateStr,
  localTimeStr,
  findAdjacentDailyNotes,
  extractDailyNoteDates
} from '../../../src/renderer/src/utils/daily-notes'

const VAULT = '/Users/test/vault'
const FOLDER = 'daily'

describe('localDateStr', () => {
  test('formats current date as YYYY-MM-DD in local time', () => {
    const result = localDateStr()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('formats a specific date in local time', () => {
    // Create a date at noon local time to avoid timezone edge cases
    const d = new Date(2026, 3, 6, 12, 0, 0) // April 6 2026 at noon local
    expect(localDateStr(d)).toBe('2026-04-06')
  })
})

describe('localTimeStr', () => {
  test('formats current time as HH:mm', () => {
    expect(localTimeStr()).toMatch(/^\d{2}:\d{2}$/)
  })

  test('zero-pads hours and minutes', () => {
    const d = new Date(2026, 0, 1, 9, 5) // 09:05
    expect(localTimeStr(d)).toBe('09:05')
  })
})

describe('dailyNotePath', () => {
  test('generates correct path for a date string', () => {
    expect(dailyNotePath(VAULT, FOLDER, '2026-04-06')).toBe('/Users/test/vault/daily/2026-04-06.md')
  })
})

describe('todayNotePath', () => {
  test('returns path with today date', () => {
    const path = todayNotePath(VAULT, FOLDER)
    const today = localDateStr()
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
    const current = new Date(2026, 3, 5, 12) // April 5 noon local
    const { prev } = findAdjacentDailyNotes(existing, VAULT, FOLDER, current)
    expect(prev).toBe('/Users/test/vault/daily/2026-04-03.md')
  })

  test('finds next daily note', () => {
    const current = new Date(2026, 3, 5, 12) // April 5 noon local
    const { next } = findAdjacentDailyNotes(existing, VAULT, FOLDER, current)
    expect(next).toBe('/Users/test/vault/daily/2026-04-10.md')
  })

  test('returns null when no adjacent notes exist', () => {
    const empty = new Set<string>()
    const current = new Date(2026, 3, 5, 12)
    const { prev, next } = findAdjacentDailyNotes(empty, VAULT, FOLDER, current)
    expect(prev).toBeNull()
    expect(next).toBeNull()
  })
})

describe('createOrOpenDailyNote', () => {
  test('uses the requested daily-note date for template expansion and frontmatter', async () => {
    const calls: { path: string; content: string }[] = []
    const originalWindow = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        api: {
          fs: {
            fileExists: async (path: string) => path === `${VAULT}/${FOLDER}`,
            mkdir: async () => undefined,
            readFile: async () => '---\ndate: {{date}}\ntime: {{time}}\n---\n# {{title}}\n',
            writeFile: async (path: string, content: string) => {
              calls.push({ path, content })
            }
          }
        }
      }
    })

    try {
      const result = await createOrOpenDailyNote(
        VAULT,
        FOLDER,
        '2026-04-03',
        `${VAULT}/template.md`
      )

      expect(result).toEqual({
        path: '/Users/test/vault/daily/2026-04-03.md',
        title: '2026-04-03'
      })
      expect(calls).toHaveLength(1)
      expect(calls[0].path).toBe('/Users/test/vault/daily/2026-04-03.md')
      expect(calls[0].content).toContain('date: 2026-04-03')
      expect(calls[0].content).toContain('# 2026-04-03')
      expect(calls[0].content).toMatch(/time: \d{2}:\d{2}/)
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow
      })
    }
  })

  test('uses the requested daily-note date when falling back to default frontmatter', async () => {
    const calls: { path: string; content: string }[] = []
    const originalWindow = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        api: {
          fs: {
            fileExists: async () => false,
            mkdir: async () => undefined,
            readFile: async () => {
              throw new Error('template missing')
            },
            writeFile: async (path: string, content: string) => {
              calls.push({ path, content })
            }
          }
        }
      }
    })

    try {
      await createOrOpenDailyNote(VAULT, FOLDER, '2026-04-03', `${VAULT}/missing-template.md`)

      expect(calls).toHaveLength(1)
      expect(calls[0].content).toContain('title: 2026-04-03')
      expect(calls[0].content).toContain('created: 2026-04-03')
      expect(calls[0].content).toContain('tags: [daily]')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow
      })
    }
  })
})
