import { describe, test, expect } from 'vitest'
import {
  expandTemplateVariables,
  buildTemplateContext,
  defaultNoteFrontmatter
} from '../../../src/renderer/src/utils/template-engine'

describe('expandTemplateVariables', () => {
  const ctx = { title: 'My Note', date: '2026-04-06', time: '14:30' }

  test('replaces {{date}}', () => {
    expect(expandTemplateVariables('Today is {{date}}', ctx)).toBe('Today is 2026-04-06')
  })

  test('replaces {{time}}', () => {
    expect(expandTemplateVariables('Now: {{time}}', ctx)).toBe('Now: 14:30')
  })

  test('replaces {{title}}', () => {
    expect(expandTemplateVariables('# {{title}}', ctx)).toBe('# My Note')
  })

  test('replaces multiple variables', () => {
    const template = '---\ntitle: {{title}}\ncreated: {{date}}\n---\n'
    const expected = '---\ntitle: My Note\ncreated: 2026-04-06\n---\n'
    expect(expandTemplateVariables(template, ctx)).toBe(expected)
  })

  test('replaces {{date:FORMAT}} with custom format', () => {
    const result = expandTemplateVariables('{{date:YYYY-MM-DD}}', ctx)
    // The custom format uses the current date, not ctx.date
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('leaves unknown variables untouched', () => {
    expect(expandTemplateVariables('{{unknown}}', ctx)).toBe('{{unknown}}')
  })

  test('handles empty content', () => {
    expect(expandTemplateVariables('', ctx)).toBe('')
  })
})

describe('buildTemplateContext', () => {
  test('creates context with title and current date/time', () => {
    const ctx = buildTemplateContext('Test Note')
    expect(ctx.title).toBe('Test Note')
    expect(ctx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(ctx.time).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('defaultNoteFrontmatter', () => {
  test('generates frontmatter with title and tags', () => {
    const fm = defaultNoteFrontmatter('My Note', ['daily'])
    expect(fm).toContain('title: My Note')
    expect(fm).toContain('tags: [daily]')
    expect(fm).toContain('created:')
    expect(fm).toMatch(/^---\n/)
    expect(fm).toMatch(/---\n\n$/)
  })

  test('generates empty tags array by default', () => {
    const fm = defaultNoteFrontmatter('Test')
    expect(fm).toContain('tags: []')
  })
})
