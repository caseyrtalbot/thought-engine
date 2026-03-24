import { Node, mergeAttributes } from '@tiptap/core'
import type { MarkdownTokenizer, MarkdownToken } from '@tiptap/core'

export type CalloutType = 'note' | 'warning' | 'tip' | 'important'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (calloutType?: CalloutType) => ReturnType
      toggleCallout: (calloutType?: CalloutType) => ReturnType
    }
  }
}

const CALLOUT_TYPES: readonly CalloutType[] = ['note', 'warning', 'tip', 'important']

const CALLOUT_COLORS: Record<CalloutType, { bg: string; border: string }> = {
  note: { bg: 'rgba(56, 189, 248, 0.08)', border: '#38bdf8' },
  warning: { bg: 'rgba(234, 179, 8, 0.08)', border: '#eab308' },
  tip: { bg: 'rgba(52, 211, 153, 0.08)', border: '#34d399' },
  important: { bg: 'rgba(168, 85, 247, 0.08)', border: '#a855f7' }
}

function isCalloutType(value: string): value is CalloutType {
  return CALLOUT_TYPES.includes(value as CalloutType)
}

export const CalloutBlock = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      calloutType: {
        default: 'note' as CalloutType,
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'note',
        renderHTML: (attributes) => ({ 'data-callout-type': attributes.calloutType })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout-type]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const type = (HTMLAttributes['data-callout-type'] as CalloutType) || 'note'
    const colors = CALLOUT_COLORS[type] || CALLOUT_COLORS.note

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout-type': type,
        style: [
          `background: ${colors.bg}`,
          `border-left: 3px solid ${colors.border}`,
          'border-radius: 4px',
          'padding: 12px 16px',
          'margin: 8px 0'
        ].join('; ')
      }),
      [
        'div',
        {
          style: [
            `color: ${colors.border}`,
            'font-size: 11px',
            'font-weight: 600',
            'text-transform: uppercase',
            'letter-spacing: 0.05em',
            'margin-bottom: 6px'
          ].join('; ')
        },
        type
      ],
      ['div', {}, 0]
    ]
  },

  addCommands() {
    return {
      setCallout:
        (calloutType: CalloutType = 'note') =>
        ({ commands }) =>
          commands.wrapIn(this.name, { calloutType }),
      toggleCallout:
        (calloutType: CalloutType = 'note') =>
        ({ commands }) => {
          if (this.editor.isActive(this.name)) {
            return commands.lift(this.name)
          }
          return commands.wrapIn(this.name, { calloutType })
        }
    }
  },

  // Custom tokenizer: intercept > [!TYPE] before the standard blockquote tokenizer
  markdownTokenizer: {
    name: 'callout',
    level: 'block',
    start(src: string) {
      const match = src.match(/^> \[!(\w+)\]/m)
      return match?.index ?? -1
    },
    tokenize(
      src: string,
      _tokens: MarkdownToken[],
      lexer: { blockTokens: (src: string) => MarkdownToken[] }
    ) {
      // Match > [!TYPE] followed by continuation lines starting with >
      const match = src.match(/^> \[!(\w+)\]\n?((?:> ?[^\n]*(?:\n|$))*)/)
      if (!match) return undefined

      const rawType = match[1].toLowerCase()
      if (!isCalloutType(rawType)) return undefined

      // Strip the > prefix from each content line
      const contentLines = match[2]
        .split('\n')
        .filter((line) => line.startsWith('>'))
        .map((line) => line.replace(/^> ?/, ''))

      const content = contentLines.join('\n').trim()

      // Parse the inner content as blocks
      const tokens = content ? lexer.blockTokens(content) : []

      return {
        type: 'callout',
        raw: match[0],
        calloutType: rawType,
        tokens
      }
    }
  } satisfies MarkdownTokenizer,

  parseMarkdown(token: MarkdownToken, helpers) {
    const parseBlockChildren = helpers.parseBlockChildren ?? helpers.parseChildren
    return helpers.createNode(
      'callout',
      { calloutType: (token as MarkdownToken & { calloutType?: string }).calloutType || 'note' },
      parseBlockChildren(token.tokens || [])
    )
  },

  renderMarkdown(node, h) {
    const type = (node.attrs as Record<string, string> | undefined)?.calloutType || 'note'

    if (!node.content) {
      return `> [!${type}]\n>`
    }

    const prefix = '>'
    const result: string[] = []

    node.content.forEach((child: { type?: string }, index: number) => {
      const childContent = h.renderChild?.(child, index) ?? h.renderChildren([child])
      const lines = childContent.split('\n')
      const linesWithPrefix = lines.map((line: string) =>
        line.trim() === '' ? prefix : `${prefix} ${line}`
      )
      result.push(linesWithPrefix.join('\n'))
    })

    return `> [!${type}]\n${result.join(`\n${prefix}\n`)}`
  }
})
