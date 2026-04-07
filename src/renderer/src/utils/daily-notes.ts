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

/** Compute the file path for a daily note. */
export function dailyNotePath(vaultPath: string, folder: string, date: Date): string {
  const dateStr = date.toISOString().slice(0, 10)
  return `${vaultPath}/${folder}/${dateStr}.md`
}

/** Get today's daily note path. */
export function todayNotePath(vaultPath: string, folder: string): string {
  return dailyNotePath(vaultPath, folder, new Date())
}

/**
 * Create a daily note if it doesn't exist, then return the path.
 *
 * If a template path is provided and the file exists, its content is used
 * with template variable substitution. Otherwise, default frontmatter is generated.
 */
export async function createOrOpenDailyNote(
  vaultPath: string,
  folder: string,
  templatePath?: string
): Promise<{ path: string; title: string }> {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const path = dailyNotePath(vaultPath, folder, now)
  const title = dateStr

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
      const ctx = buildTemplateContext(title)
      content = expandTemplateVariables(templateContent, ctx)
    } catch {
      // Template not found — fall back to defaults
      content = defaultNoteFrontmatter(title, ['daily'])
    }
  } else {
    content = defaultNoteFrontmatter(title, ['daily'])
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
    const p = dailyNotePath(vaultPath, folder, d)
    if (existingPaths.has(p)) {
      prev = p
      break
    }
  }

  // Search forward
  for (let i = 1; i <= searchDays; i++) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + i)
    const p = dailyNotePath(vaultPath, folder, d)
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
