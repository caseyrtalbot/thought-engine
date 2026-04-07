import { describe, it, expect } from 'vitest'
import { marked } from 'marked'

/**
 * Fixture-driven tests for GFM table markdown round-tripping.
 *
 * Phase 3D1 uses Tiptap 3's built-in table parseMarkdown/renderMarkdown
 * together with marked's native GFM table tokenizer. These tests verify
 * that marked correctly tokenizes table markdown, and that the Tiptap
 * extension's renderMarkdown produces valid GFM output.
 */

// ── Tokenization (marked → table token) ──────────────────────────────

describe('marked GFM table tokenization', () => {
  function getTableToken(md: string) {
    const tokens = marked.lexer(md)
    return tokens.find((t) => t.type === 'table') as
      | (marked.Tokens.Table & { type: 'table' })
      | undefined
  }

  it('parses a basic 2-column table', () => {
    const token = getTableToken('| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(token).toBeDefined()
    expect(token!.header).toHaveLength(2)
    expect(token!.header[0].text).toBe('A')
    expect(token!.header[1].text).toBe('B')
    expect(token!.rows).toHaveLength(1)
    expect(token!.rows[0][0].text).toBe('1')
    expect(token!.rows[0][1].text).toBe('2')
  })

  it('parses alignment markers', () => {
    const token = getTableToken('| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |')
    expect(token).toBeDefined()
    expect(token!.align).toEqual(['left', 'center', 'right'])
  })

  it('handles null alignment (no markers)', () => {
    const token = getTableToken('| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(token).toBeDefined()
    expect(token!.align).toEqual([null, null])
  })

  it('parses empty cells', () => {
    const token = getTableToken('| A | B |\n| --- | --- |\n|  | 2 |')
    expect(token).toBeDefined()
    expect(token!.rows[0][0].text).toBe('')
    expect(token!.rows[0][1].text).toBe('2')
  })

  it('parses multi-row tables', () => {
    const token = getTableToken(
      '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |\n| Charlie | 35 |'
    )
    expect(token).toBeDefined()
    expect(token!.rows).toHaveLength(3)
  })

  it('parses header-only table (no body rows)', () => {
    const token = getTableToken('| A | B |\n| --- | --- |')
    expect(token).toBeDefined()
    expect(token!.header).toHaveLength(2)
    expect(token!.rows).toHaveLength(0)
  })

  it('parses escaped pipes in cell content', () => {
    const token = getTableToken('| A | B |\n| --- | --- |\n| foo\\|bar | baz |')
    expect(token).toBeDefined()
    // marked handles escaped pipes: the cell text should have the literal pipe
    expect(token!.rows[0][0].text).toContain('|')
  })

  it('parses inline formatting in cells', () => {
    const token = getTableToken('| A | B |\n| --- | --- |\n| **bold** | *italic* |')
    expect(token).toBeDefined()
    // Tokens array should contain inline formatting tokens
    expect(token!.rows[0][0].tokens.length).toBeGreaterThan(0)
    expect(token!.rows[0][1].tokens.length).toBeGreaterThan(0)
  })

  it('handles tables without leading pipes', () => {
    const token = getTableToken('A | B\n--- | ---\n1 | 2')
    expect(token).toBeDefined()
    expect(token!.header[0].text).toBe('A')
    expect(token!.rows[0][0].text).toBe('1')
  })

  it('handles single-column table', () => {
    const token = getTableToken('| A |\n| --- |\n| 1 |')
    expect(token).toBeDefined()
    expect(token!.header).toHaveLength(1)
    expect(token!.rows[0]).toHaveLength(1)
  })
})

// ── Tiptap extension parseMarkdown/renderMarkdown ────────────────────

describe('Tiptap table parseMarkdown', () => {
  it('exports parseMarkdown function', async () => {
    const { Table } = await import('@tiptap/extension-table')
    const config = Table.config as Record<string, unknown>
    expect(typeof config.parseMarkdown).toBe('function')
  })

  it('exports renderMarkdown function', async () => {
    const { Table } = await import('@tiptap/extension-table')
    const config = Table.config as Record<string, unknown>
    expect(typeof config.renderMarkdown).toBe('function')
  })
})

// ── renderMarkdown output format ─────────────────────────────────────

describe('renderTableToMarkdown', () => {
  it('renders a basic table to GFM', async () => {
    const { renderTableToMarkdown } = await import('@tiptap/extension-table')

    // renderTableToMarkdown checks cellNode.type as a string (not .name)
    // and calls h.renderChildren(cellNode.content) where content is the array
    const node = {
      content: [
        {
          // header row
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: {},
              content: [{ type: 'paragraph', text: 'Name' }]
            },
            {
              type: 'tableHeader',
              attrs: {},
              content: [{ type: 'paragraph', text: 'Age' }]
            }
          ]
        },
        {
          // body row
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {},
              content: [{ type: 'paragraph', text: 'Alice' }]
            },
            {
              type: 'tableCell',
              attrs: {},
              content: [{ type: 'paragraph', text: '30' }]
            }
          ]
        }
      ]
    }

    // renderChildren receives either the content array or a single child node
    const helpers = {
      renderChildren: (input: unknown) => {
        if (Array.isArray(input)) {
          return (input as Array<{ text?: string }>).map((c) => c.text ?? '').join('')
        }
        return (input as { text?: string }).text ?? ''
      }
    }

    const md = renderTableToMarkdown(node as never, helpers as never)
    expect(md).toContain('|')
    expect(md).toContain('Name')
    expect(md).toContain('Age')
    expect(md).toContain('Alice')
    expect(md).toContain('30')
    // Should contain separator row
    expect(md).toMatch(/---/)
  })
})

// ── Round-trip symmetry ──────────────────────────────────────────────

describe('round-trip: markdown → tokens → markdown structure', () => {
  it('preserves column count through tokenization', () => {
    const md = '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |'
    const tokens = marked.lexer(md)
    const table = tokens.find((t) => t.type === 'table') as marked.Tokens.Table
    expect(table.header).toHaveLength(3)
    expect(table.rows[0]).toHaveLength(3)
  })

  it('preserves alignment through tokenization', () => {
    const md = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |'
    const tokens = marked.lexer(md)
    const table = tokens.find((t) => t.type === 'table') as marked.Tokens.Table
    expect(table.align).toEqual(['left', 'center', 'right'])
  })

  it('preserves content through tokenization', () => {
    const md = '| Hello World | Foo Bar |\n| --- | --- |\n| test 1 | test 2 |'
    const tokens = marked.lexer(md)
    const table = tokens.find((t) => t.type === 'table') as marked.Tokens.Table
    expect(table.header[0].text).toBe('Hello World')
    expect(table.header[1].text).toBe('Foo Bar')
    expect(table.rows[0][0].text).toBe('test 1')
    expect(table.rows[0][1].text).toBe('test 2')
  })
})
