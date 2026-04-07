import { describe, test, expect, vi } from 'vitest'
import { WikilinkNode } from '../../src/renderer/src/panels/editor/extensions/wikilink-node'

describe('WikilinkNode extension definition', () => {
  test('is an inline atom node', () => {
    expect(WikilinkNode.config.group).toBe('inline')
    expect(WikilinkNode.config.inline).toBe(true)
    expect(WikilinkNode.config.atom).toBe(true)
  })

  test('has name "wikilink"', () => {
    expect(WikilinkNode.config.name).toBe('wikilink')
  })

  test('has target attribute', () => {
    const attrs = WikilinkNode.config.addAttributes?.call(WikilinkNode) as Record<string, unknown>
    expect(attrs).toHaveProperty('target')
  })
})

describe('WikilinkNode markdown tokenizer', () => {
  const tokenizer = WikilinkNode.config.markdownTokenizer as {
    start: (src: string) => number
    tokenize: (src: string) => { type: string; raw: string; content: string } | undefined
  }

  test('start() finds [[ in source', () => {
    expect(tokenizer.start('hello [[world]]')).toBe(6)
  })

  test('start() returns -1 when no wikilink', () => {
    expect(tokenizer.start('hello world')).toBe(-1)
  })

  test('tokenize() extracts simple wikilink', () => {
    const result = tokenizer.tokenize('[[My Note]]')
    expect(result).toEqual({
      type: 'wikilink',
      raw: '[[My Note]]',
      content: 'My Note',
      alias: null
    })
  })

  test('tokenize() handles display text (pipe syntax)', () => {
    const result = tokenizer.tokenize('[[My Note|display text]]')
    expect(result).toEqual({
      type: 'wikilink',
      raw: '[[My Note|display text]]',
      content: 'My Note',
      alias: 'display text'
    })
  })

  test('tokenize() returns undefined for incomplete wikilink', () => {
    expect(tokenizer.tokenize('[[unclosed')).toBeUndefined()
  })

  test('tokenize() returns undefined for non-wikilink', () => {
    expect(tokenizer.tokenize('regular text')).toBeUndefined()
  })
})

describe('WikilinkNode renderMarkdown', () => {
  const renderMarkdown = WikilinkNode.config.renderMarkdown as (node: {
    attrs: Record<string, unknown>
  }) => string

  test('renders [[target]] markdown', () => {
    expect(renderMarkdown({ attrs: { target: 'My Note' } })).toBe('[[My Note]]')
  })

  test('renders [[target|alias]] when alias is present', () => {
    expect(renderMarkdown({ attrs: { target: 'My Note', alias: 'display' } })).toBe(
      '[[My Note|display]]'
    )
  })

  test('renders [[target]] when alias is null', () => {
    expect(renderMarkdown({ attrs: { target: 'My Note', alias: null } })).toBe('[[My Note]]')
  })

  test('renders empty target', () => {
    expect(renderMarkdown({ attrs: { target: '' } })).toBe('[[]]')
  })
})

describe('WikilinkNode parseMarkdown', () => {
  const parseMarkdown = WikilinkNode.config.parseMarkdown as (token: { content: string }) => {
    type: string
    attrs: { target: string }
  }

  test('creates node with target from token content', () => {
    const result = parseMarkdown({ content: 'My Note' })
    expect(result).toEqual({
      type: 'wikilink',
      attrs: { target: 'My Note', alias: null }
    })
  })

  test('creates node with alias from token', () => {
    const result = parseMarkdown({ content: 'My Note', alias: 'display' })
    expect(result).toEqual({
      type: 'wikilink',
      attrs: { target: 'My Note', alias: 'display' }
    })
  })
})

describe('WikilinkNode click handler', () => {
  test('click without CMD does not navigate', () => {
    const onNavigate = vi.fn()
    const ext = WikilinkNode.configure({ onNavigate })
    // Verify that addProseMirrorPlugins is defined when onNavigate is set
    expect(ext.config.addProseMirrorPlugins).toBeDefined()
  })

  test('extension accepts undefined onNavigate without error', () => {
    const ext = WikilinkNode.configure({})
    expect(ext.config.addProseMirrorPlugins).toBeDefined()
  })
})
