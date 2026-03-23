import { describe, it, expect } from 'vitest'

// Test the markdown tokenizer and serialization logic directly
// without needing a full Tiptap editor instance

describe('ConceptNodeMark markdown', () => {
  // Import the tokenizer from the extension
  const getTokenizer = async () => {
    const { ConceptNodeMark } =
      await import('../../src/renderer/src/panels/editor/extensions/concept-node-mark')
    return (ConceptNodeMark.config as Record<string, unknown>).markdownTokenizer as {
      name: string
      level: string
      start: (src: string) => number
      tokenize: (src: string) => { type: string; raw: string; content: string } | undefined
    }
  }

  const getRenderMarkdown = async () => {
    const { ConceptNodeMark } =
      await import('../../src/renderer/src/panels/editor/extensions/concept-node-mark')
    return (ConceptNodeMark.config as Record<string, unknown>).renderMarkdown as (
      node: { content?: { type: string; text: string }[] },
      h: { renderChildren: (node: unknown) => string }
    ) => string
  }

  describe('tokenizer.start', () => {
    it('finds <node> tag in text', async () => {
      const tokenizer = await getTokenizer()
      expect(tokenizer.start('hello <node>term</node> world')).toBe(6)
    })

    it('returns -1 when no <node> tag exists', async () => {
      const tokenizer = await getTokenizer()
      expect(tokenizer.start('hello world')).toBe(-1)
    })
  })

  describe('tokenizer.tokenize', () => {
    it('extracts content from <node> tags', async () => {
      const tokenizer = await getTokenizer()
      const result = tokenizer.tokenize('<node>concept term</node> rest')
      expect(result).toEqual({
        type: 'conceptNode',
        raw: '<node>concept term</node>',
        content: 'concept term'
      })
    })

    it('returns undefined for non-matching input', async () => {
      const tokenizer = await getTokenizer()
      expect(tokenizer.tokenize('no tags here')).toBeUndefined()
    })

    it('handles empty <node> tags', async () => {
      const tokenizer = await getTokenizer()
      const result = tokenizer.tokenize('<node></node>')
      expect(result).toEqual({
        type: 'conceptNode',
        raw: '<node></node>',
        content: ''
      })
    })

    it('handles <node> with special characters', async () => {
      const tokenizer = await getTokenizer()
      const result = tokenizer.tokenize('<node>term with & special < chars</node>')
      expect(result).toBeDefined()
      expect(result!.content).toBe('term with & special < chars')
    })
  })

  describe('renderMarkdown', () => {
    it('wraps children in <node> tags', async () => {
      const render = await getRenderMarkdown()
      const mockNode = { content: [{ type: 'text', text: 'concept' }] }
      const mockHelpers = { renderChildren: () => 'concept' }
      expect(render(mockNode, mockHelpers)).toBe('<node>concept</node>')
    })
  })
})
