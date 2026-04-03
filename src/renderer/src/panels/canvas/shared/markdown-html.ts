import { Editor, generateHTML } from '@tiptap/core'
import MarkdownIt from 'markdown-it'
import { getCanvasEditorExtensions } from './tiptap-config'

// Separate extension instances for parser vs generateHTML.
// Tiptap mutates extension state during Editor construction;
// sharing the same array between Editor and generateHTML is unsafe.
const parserExtensions = getCanvasEditorExtensions()
const renderExtensions = getCanvasEditorExtensions()

// Headless editor for markdown parsing only. Never mounted to DOM.
let parserEditor: Editor | null = null

function getParser(): Editor {
  if (!parserEditor) {
    parserEditor = new Editor({ extensions: parserExtensions, content: '' })
  }
  return parserEditor
}

// Direct markdown-it instance as a reliable fallback.
// The Tiptap Markdown manager can fail to initialize at runtime
// (async editor construction, extension ordering, etc.).
let mdIt: MarkdownIt | null = null

function getMarkdownIt(): MarkdownIt {
  if (!mdIt) {
    mdIt = new MarkdownIt({ html: true, linkify: true, typographer: false })
  }
  return mdIt
}

export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return ''

  // Try Tiptap's Markdown manager first (produces Tiptap-compatible HTML)
  try {
    const editor = getParser()
    const manager = editor.storage.markdown?.manager
    if (manager) {
      const doc = manager.parse(markdown)
      return generateHTML(doc, renderExtensions)
    }
  } catch {
    // Fall through to markdown-it
  }

  // Fallback: use markdown-it directly
  return getMarkdownIt().render(markdown)
}
