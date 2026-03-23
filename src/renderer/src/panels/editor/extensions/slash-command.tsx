import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion } from '@tiptap/suggestion'
import { createRoot } from 'react-dom/client'
import { SlashCommandList, type SlashCommandItem } from './slash-command-list'
import { floatingPanel } from '../../../design/tokens'

const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    }
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    }
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    }
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: '\u2022',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    }
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: '1.',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    }
  },
  {
    title: 'Task List',
    description: 'Checkboxes',
    icon: '\u2610',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    }
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: '<>',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    }
  },
  {
    title: 'Blockquote',
    description: 'Quoted text',
    icon: '\u275D',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    }
  },
  {
    title: 'Callout',
    description: 'Highlighted block (note, tip, warning)',
    icon: '\u25A1',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).setCallout('note').run()
    }
  },
  {
    title: 'Divider',
    description: 'Horizontal line',
    icon: '\u2500',
    command: ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    }
  }
]

function filterItems(query: string): SlashCommandItem[] {
  if (!query) return SLASH_COMMAND_ITEMS
  const lower = query.toLowerCase()
  return SLASH_COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(lower) || item.description.toLowerCase().includes(lower)
  )
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        pluginKey: new PluginKey('slashCommand'),
        items: ({ query }) => filterItems(query),
        allow: ({ state, range }) => {
          // Only trigger at the start of a block (after optional whitespace)
          const $from = state.doc.resolve(range.from)
          const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
          return textBefore.trim() === ''
        },
        render: () => {
          let container: HTMLDivElement | null = null
          let root: ReturnType<typeof createRoot> | null = null

          return {
            onStart: (props) => {
              container = document.createElement('div')
              container.style.position = 'fixed'
              container.style.zIndex = '999'
              container.style.animation = 'te-scale-in 150ms ease-out'
              document.body.appendChild(container)

              root = createRoot(container)

              const rect = props.clientRect?.()
              if (rect) {
                container.style.left = `${rect.left}px`
                container.style.top = `${rect.bottom + 4}px`
              }

              root.render(
                <div
                  style={{
                    width: 280,
                    backgroundColor: floatingPanel.glass.bg,
                    backdropFilter: floatingPanel.glass.blur,
                    borderRadius: floatingPanel.borderRadius,
                    boxShadow: floatingPanel.shadow,
                    overflow: 'hidden'
                  }}
                >
                  <SlashCommandList
                    items={props.items as SlashCommandItem[]}
                    command={(item) => {
                      item.command({
                        editor: props.editor,
                        range: props.range
                      })
                    }}
                  />
                </div>
              )
            },

            onUpdate: (props) => {
              const rect = props.clientRect?.()
              if (rect && container) {
                container.style.left = `${rect.left}px`
                container.style.top = `${rect.bottom + 4}px`
              }

              root?.render(
                <div
                  style={{
                    width: 280,
                    backgroundColor: floatingPanel.glass.bg,
                    backdropFilter: floatingPanel.glass.blur,
                    borderRadius: floatingPanel.borderRadius,
                    boxShadow: floatingPanel.shadow,
                    overflow: 'hidden'
                  }}
                >
                  <SlashCommandList
                    items={props.items as SlashCommandItem[]}
                    command={(item) => {
                      item.command({
                        editor: props.editor,
                        range: props.range
                      })
                    }}
                  />
                </div>
              )
            },

            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                return true
              }
              const handler = (
                SlashCommandList as unknown as { onKeyDown?: (e: KeyboardEvent) => boolean }
              ).onKeyDown
              return handler?.(props.event) ?? false
            },

            onExit: () => {
              root?.unmount()
              container?.remove()
              root = null
              container = null
            }
          }
        }
      })
    ]
  }
})
