/**
 * Daily notes — date-named notes in a configurable folder.
 *
 * Creates/opens notes named by date (e.g., daily/2026-04-06.md).
 * Integrates with the template system for initial content.
 */

import {
  expandTemplateVariables,
  buildTemplateContext,
  defaultNoteFrontmatter
} from './template-engine'

const pad = (n: number): string => String(n).padStart(2, '0')

function localMomentFromDateStr(dateStr: string, timeSource: Date = new Date()): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return new Date(timeSource)

  const [, year, month, day] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  )
}

/** Format a Date as YYYY-MM-DD in local time. Never use toISOString() for dates the user sees. */
export function localDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Format a Date as HH:mm in local time. */
export function localTimeStr(date: Date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Compute the file path for a daily note from a YYYY-MM-DD string. */
export function dailyNotePath(vaultPath: string, folder: string, dateStr: string): string {
  return `${vaultPath}/${folder}/${dateStr}.md`
}

/** Get today's daily note path. */
export function todayNotePath(vaultPath: string, folder: string): string {
  return dailyNotePath(vaultPath, folder, localDateStr())
}

/**
 * Create a daily note if it doesn't exist, then return the path.
 *
 * If a template path is provided and the file exists, its content is used
 * with template variable substitution. Otherwise, default frontmatter is generated.
 *
 * @param dateStr YYYY-MM-DD string (local time). Use localDateStr() for "today".
 */
export async function createOrOpenDailyNote(
  vaultPath: string,
  folder: string,
  dateStr: string,
  templatePath?: string
): Promise<{ path: string; title: string }> {
  const path = dailyNotePath(vaultPath, folder, dateStr)
  const title = dateStr
  const noteMoment = localMomentFromDateStr(dateStr)

  const exists = await window.api.fs.fileExists(path)
  if (exists) return { path, title }

  // Ensure folder exists
  const folderPath = `${vaultPath}/${folder}`
  const folderExists = await window.api.fs.fileExists(folderPath)
  if (!folderExists) {
    await window.api.fs.mkdir(folderPath)
  }

  // Build content from template or defaults
  let content: string
  if (templatePath) {
    try {
      const templateContent = await window.api.fs.readFile(templatePath)
      const ctx = buildTemplateContext(title, noteMoment)
      content = expandTemplateVariables(templateContent, ctx)
    } catch {
      // Template not found — fall back to defaults
      content = defaultNoteFrontmatter(title, ['daily'], noteMoment)
    }
  } else {
    content = defaultNoteFrontmatter(title, ['daily'], noteMoment)
  }

  await window.api.fs.writeFile(path, content)
  return { path, title }
}

/**
 * Find adjacent daily notes relative to a given date.
 * Returns paths of existing daily notes before and after the given date.
 */
export function findAdjacentDailyNotes(
  existingPaths: ReadonlySet<string>,
  vaultPath: string,
  folder: string,
  currentDate: Date,
  searchDays = 90
): { prev: string | null; next: string | null } {
  let prev: string | null = null
  let next: string | null = null

  // Search backward
  for (let i = 1; i <= searchDays; i++) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - i)
    const p = dailyNotePath(vaultPath, folder, localDateStr(d))
    if (existingPaths.has(p)) {
      prev = p
      break
    }
  }

  // Search forward
  for (let i = 1; i <= searchDays; i++) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + i)
    const p = dailyNotePath(vaultPath, folder, localDateStr(d))
    if (existingPaths.has(p)) {
      next = p
      break
    }
  }

  return { prev, next }
}

/**
 * Extract dates that have daily notes from a list of file paths.
 * Returns a Set of YYYY-MM-DD strings.
 */
export function extractDailyNoteDates(
  files: readonly { readonly path: string }[],
  vaultPath: string,
  folder: string
): ReadonlySet<string> {
  const prefix = `${vaultPath}/${folder}/`
  const dates = new Set<string>()
  for (const file of files) {
    if (file.path.startsWith(prefix) && file.path.endsWith('.md')) {
      const name = file.path.slice(prefix.length, -3)
      // Validate it looks like a date (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(name)) {
        dates.add(name)
      }
    }
  }
  return dates
}
