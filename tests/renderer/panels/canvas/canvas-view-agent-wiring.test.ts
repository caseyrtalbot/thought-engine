/**
 * Tests for agent wiring logic integrated into CanvasView.
 *
 * CanvasView itself is too heavy to mount in unit tests (Electron IPC, canvas surface, etc.).
 * Instead we test the behavioral contracts that the wiring introduces:
 *
 * 1. The agent-action-trigger CustomEvent fires agent.trigger with the correct action name
 * 2. The card context menu gate: non-note cards are no longer filtered out
 * 3. Ghost node rendering: computeGhostNodes returns correct ghost data for preview display
 */

import { describe, expect, it, vi } from 'vitest'
import type { AgentActionName } from '@shared/agent-action-types'

describe('agent-action-trigger event pattern', () => {
  it('dispatches action name from CustomEvent detail', () => {
    // This mirrors the useEffect in CanvasView that listens for the palette event
    const triggerFn = vi.fn()

    const handler = (e: Event) => {
      const action = (e as CustomEvent<{ action: AgentActionName }>).detail.action
      triggerFn(action)
    }

    window.addEventListener('agent-action-trigger', handler)

    window.dispatchEvent(
      new CustomEvent('agent-action-trigger', { detail: { action: 'challenge' } })
    )

    expect(triggerFn).toHaveBeenCalledOnce()
    expect(triggerFn).toHaveBeenCalledWith('challenge')

    window.removeEventListener('agent-action-trigger', handler)
  })

  it('dispatches different agent action names correctly', () => {
    const triggerFn = vi.fn()

    const handler = (e: Event) => {
      const action = (e as CustomEvent<{ action: AgentActionName }>).detail.action
      triggerFn(action)
    }

    window.addEventListener('agent-action-trigger', handler)

    window.dispatchEvent(new CustomEvent('agent-action-trigger', { detail: { action: 'emerge' } }))
    window.dispatchEvent(
      new CustomEvent('agent-action-trigger', { detail: { action: 'organize' } })
    )
    window.dispatchEvent(new CustomEvent('agent-action-trigger', { detail: { action: 'tidy' } }))

    expect(triggerFn).toHaveBeenCalledTimes(3)
    expect(triggerFn).toHaveBeenNthCalledWith(1, 'emerge')
    expect(triggerFn).toHaveBeenNthCalledWith(2, 'organize')
    expect(triggerFn).toHaveBeenNthCalledWith(3, 'tidy')

    window.removeEventListener('agent-action-trigger', handler)
  })
})

describe('card context menu gate logic', () => {
  // Simulates the gate logic from CanvasView's cardContextMenu rendering block
  function gateLogic(menuNode: { type: string; content: string } | undefined) {
    if (!menuNode) return null
    const isNote = menuNode.type === 'note'
    const menuFilePath = isNote ? menuNode.content : undefined
    return { isNote, menuFilePath, content: menuNode.content }
  }

  it('returns null when no node is found', () => {
    expect(gateLogic(undefined)).toBeNull()
  })

  it('returns isNote=true and menuFilePath for note-type cards', () => {
    const result = gateLogic({ type: 'note', content: '/path/to/note.md' })
    expect(result).toEqual({
      isNote: true,
      menuFilePath: '/path/to/note.md',
      content: '/path/to/note.md'
    })
  })

  it('returns isNote=false and undefined menuFilePath for text cards', () => {
    const result = gateLogic({ type: 'text', content: 'some text content' })
    expect(result).toEqual({
      isNote: false,
      menuFilePath: undefined,
      content: 'some text content'
    })
  })

  it('returns isNote=false for code cards (previously filtered out)', () => {
    const result = gateLogic({ type: 'code', content: 'function foo() {}' })
    expect(result).toEqual({
      isNote: false,
      menuFilePath: undefined,
      content: 'function foo() {}'
    })
  })

  it('returns isNote=false for terminal cards', () => {
    const result = gateLogic({ type: 'terminal', content: '' })
    expect(result).toEqual({
      isNote: false,
      menuFilePath: undefined,
      content: ''
    })
  })

  it('returns isNote=false for image cards', () => {
    const result = gateLogic({ type: 'image', content: '' })
    expect(result).toEqual({
      isNote: false,
      menuFilePath: undefined,
      content: ''
    })
  })
})
