import { Mark, mergeAttributes } from '@tiptap/core'
import type { MarkdownTokenizer } from '@tiptap/core'

export interface ConceptNodeMarkOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    conceptNodeMark: {
      setConceptNode: () => ReturnType
      unsetConceptNode: () => ReturnType
      toggleConceptNode: () => ReturnType
    }
  }
}

export const ConceptNodeMark = Mark.create<ConceptNodeMarkOptions>({
  name: 'conceptNode',

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  parseHTML() {
    return [{ tag: 'node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['node', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setConceptNode:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      unsetConceptNode:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
      toggleConceptNode:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name)
    }
  },

  // v3 markdown serialization (replaces v2 addStorage().markdown)
  markdownTokenizer: {
    name: 'conceptNode',
    level: 'inline',
    start(src: string) {
      const idx = src.indexOf('<node>')
      return idx >= 0 ? idx : -1
    },
    tokenize(src: string) {
      const match = src.match(/^<node>([\s\S]*?)<\/node>/)
      if (!match) return undefined
      return {
        type: 'conceptNode',
        raw: match[0],
        content: match[1]
      }
    }
  } satisfies MarkdownTokenizer,

  parseMarkdown(token, helpers) {
    return helpers.applyMark('conceptNode', [helpers.createTextNode(token.content || '')])
  },

  renderMarkdown(node, h) {
    return `<node>${h.renderChildren(node)}</node>`
  }
})
