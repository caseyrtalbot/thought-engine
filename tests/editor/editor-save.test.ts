import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../../src/renderer/src/store/editor-store'

describe('editor-store markSaved', () => {
  beforeEach(() => {
    useEditorStore.setState({
      isDirty: false,
      content: '',
      activeNotePath: null,
      activeNoteId: null
    })
  })

  it('clears dirty flag after save', () => {
    const store = useEditorStore.getState()
    store.loadContent('initial')
    store.setContent('modified')
    expect(useEditorStore.getState().isDirty).toBe(true)

    store.markSaved()
    expect(useEditorStore.getState().isDirty).toBe(false)
  })

  it('does not clear content on save', () => {
    const store = useEditorStore.getState()
    store.loadContent('initial')
    store.setContent('modified content')
    store.markSaved()
    expect(useEditorStore.getState().content).toBe('modified content')
  })
})
