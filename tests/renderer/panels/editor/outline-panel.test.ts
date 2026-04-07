import { describe, test, expect } from 'vitest'
import {
  extractHeadings,
  type HeadingEntry
} from '../../../../src/renderer/src/panels/editor/outline-utils'

/**
 * Minimal mock of a Tiptap Editor with a doc that has heading nodes.
 * Only models what extractHeadings needs: state.doc.descendants().
 */
function mockEditor(headings: { level: number; text: string; pos: number }[]) {
  return {
    isDestroyed: false,
    state: {
      doc: {
        descendants(
          callback: (
            node: { type: { name: string }; attrs: { level: number }; textContent: string },
            pos: number
          ) => boolean | void
        ) {
          for (const h of headings) {
            const result = callback(
              { type: { name: 'heading' }, attrs: { level: h.level }, textContent: h.text },
              h.pos
            )
            if (result === false) return
          }
        }
      },
      selection: { from: 0 }
    }
  } as never
}

describe('extractHeadings', () => {
  test('extracts headings from editor document', () => {
    const editor = mockEditor([
      { level: 1, text: 'Title', pos: 0 },
      { level: 2, text: 'Section A', pos: 50 },
      { level: 3, text: 'Subsection', pos: 100 },
      { level: 2, text: 'Section B', pos: 200 }
    ])

    const result = extractHeadings(editor)

    expect(result).toEqual([
      { level: 1, text: 'Title', pos: 0 },
      { level: 2, text: 'Section A', pos: 50 },
      { level: 3, text: 'Subsection', pos: 100 },
      { level: 2, text: 'Section B', pos: 200 }
    ])
  })

  test('returns empty array for document with no headings', () => {
    const editor = mockEditor([])
    expect(extractHeadings(editor)).toEqual([])
  })

  test('handles document with only one heading', () => {
    const editor = mockEditor([{ level: 1, text: 'Only Heading', pos: 0 }])
    const result = extractHeadings(editor)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ level: 1, text: 'Only Heading', pos: 0 })
  })

  test('preserves heading levels for indentation', () => {
    const editor = mockEditor([
      { level: 2, text: 'H2 First', pos: 0 },
      { level: 4, text: 'H4 Deep', pos: 50 },
      { level: 2, text: 'H2 Second', pos: 100 }
    ])

    const result = extractHeadings(editor)
    expect(result.map((h: HeadingEntry) => h.level)).toEqual([2, 4, 2])
  })

  test('handles empty heading text', () => {
    const editor = mockEditor([{ level: 1, text: '', pos: 0 }])
    const result = extractHeadings(editor)
    expect(result[0].text).toBe('')
  })
})
