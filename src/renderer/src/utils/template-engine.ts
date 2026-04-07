/**
 * Template engine — variable substitution for note templates.
 *
 * Templates are regular .md files with {{variable}} placeholders.
 * Substitution happens at creation time (not runtime rendering).
 */

export interface TemplateContext {
  readonly title: string
  readonly date: string // YYYY-MM-DD
  readonly time: string // HH:mm
}

/** Simple date formatting. Supports YYYY, MM, DD, MMMM, M, D, HH, mm. */
function formatDate(date: Date, format: string): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]
  const pad = (n: number): string => String(n).padStart(2, '0')

  return format
    .replace('YYYY', String(date.getFullYear()))
    .replace('MMMM', months[date.getMonth()])
    .replace('MM', pad(date.getMonth() + 1))
    .replace(/\bM\b/, String(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace(/\bD\b/, String(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
}

/**
 * Expand template variables in content.
 *
 * Supported variables:
 * - {{date}} — today's date (YYYY-MM-DD)
 * - {{time}} — current time (HH:mm)
 * - {{title}} — the note's title
 * - {{date:FORMAT}} — date with custom format (e.g., {{date:MMMM D, YYYY}})
 */
export function expandTemplateVariables(content: string, ctx: TemplateContext): string {
  const now = new Date()

  return content
    .replace(/\{\{date:([^}]+)\}\}/g, (_match, fmt: string) => formatDate(now, fmt))
    .replace(/\{\{date\}\}/g, ctx.date)
    .replace(/\{\{time\}\}/g, ctx.time)
    .replace(/\{\{title\}\}/g, ctx.title)
}

/** Build a TemplateContext for the current moment. */
export function buildTemplateContext(title: string): TemplateContext {
  const now = new Date()
  return {
    title,
    date: now.toISOString().slice(0, 10),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }
}

/** Generate default frontmatter for a new note. */
export function defaultNoteFrontmatter(title: string, tags: readonly string[] = []): string {
  const now = new Date().toISOString().slice(0, 10)
  const tagList = tags.length > 0 ? `[${tags.join(', ')}]` : '[]'
  return `---\ntitle: ${title}\ncreated: ${now}\ntags: ${tagList}\n---\n\n`
}
