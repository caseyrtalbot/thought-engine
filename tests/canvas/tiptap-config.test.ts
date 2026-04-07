import { describe, it, expect } from 'vitest'
import { getCanvasEditorExtensions } from '../../src/renderer/src/panels/canvas/shared/tiptap-config'

describe('getCanvasEditorExtensions', () => {
  it('includes table support via MachinaTableKit', () => {
    const extensions = getCanvasEditorExtensions()
    const extensionNames = extensions.map((ext) => {
      // Tiptap extensions expose their name via .name or .config.name
      // TableKit is a kit that registers multiple extensions
      if ('name' in ext) return (ext as { name: string }).name
      return undefined
    })

    // MachinaTableKit (via @tiptap/extension-table's TableKit) registers as 'tableKit'
    expect(extensionNames).toContain('tableKit')
  })

  it('includes all extensions from the main editor that canvas needs', () => {
    const extensions = getCanvasEditorExtensions()
    const extensionNames = extensions.map((ext) => {
      if ('name' in ext) return (ext as { name: string }).name
      return undefined
    })

    // Core extensions that both main editor and canvas must share
    expect(extensionNames).toContain('starterKit')
    expect(extensionNames).toContain('taskList')
    expect(extensionNames).toContain('taskItem')
    expect(extensionNames).toContain('tableKit')
  })
})
