import type { Editor } from '@tiptap/react'

export interface HeadingEntry {
  readonly level: number
  readonly text: string
  readonly pos: number
}

/** Extract all headings from the editor document. */
export function extractHeadings(editor: Editor): readonly HeadingEntry[] {
  const headings: HeadingEntry[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        level: node.attrs.level as number,
        text: node.textContent,
        pos
      })
    }
  })
  return headings
}

/** Find the heading that contains or immediately precedes the cursor. */
export function findActiveHeading(
  headings: readonly HeadingEntry[],
  cursorPos: number
): number | null {
  let activeIdx: number | null = null
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].pos <= cursorPos) {
      activeIdx = i
    } else {
      break
    }
  }
  return activeIdx
}
