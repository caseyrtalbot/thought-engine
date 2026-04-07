import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useUiStore, rehydrateUiStore } from '../../src/renderer/src/store/ui-store'
import * as vaultPersist from '../../src/renderer/src/store/vault-persist'

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ backlinkCollapsed: {} })
  })

  test('defaults to collapsed (true) for unknown note paths', () => {
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(true)
  })

  test('toggleBacklinkCollapsed flips from default collapsed to expanded', () => {
    useUiStore.getState().toggleBacklinkCollapsed('/notes/a.md')
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(false)
  })

  test('toggleBacklinkCollapsed flips back to collapsed', () => {
    useUiStore.getState().toggleBacklinkCollapsed('/notes/a.md')
    useUiStore.getState().toggleBacklinkCollapsed('/notes/a.md')
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(true)
  })

  test('different note paths are independent', () => {
    useUiStore.getState().toggleBacklinkCollapsed('/notes/a.md')
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(false)
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/b.md')).toBe(true)
  })

  test('rehydrate restores persisted state', () => {
    useUiStore.getState().rehydrate({ '/notes/a.md': false, '/notes/b.md': true }, [], false)
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(false)
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/b.md')).toBe(true)
  })

  test('rehydrate with empty object resets to defaults', () => {
    useUiStore.getState().toggleBacklinkCollapsed('/notes/a.md')
    useUiStore.getState().rehydrate({}, [], false)
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(true)
  })

  test('outlineVisible defaults to false', () => {
    expect(useUiStore.getState().outlineVisible).toBe(false)
  })

  test('toggleOutline flips visibility', () => {
    useUiStore.getState().toggleOutline()
    expect(useUiStore.getState().outlineVisible).toBe(true)
    useUiStore.getState().toggleOutline()
    expect(useUiStore.getState().outlineVisible).toBe(false)
  })

  test('rehydrate restores outlineVisible', () => {
    useUiStore.getState().rehydrate({}, [], true)
    expect(useUiStore.getState().outlineVisible).toBe(true)
  })
})

describe('rehydrateUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ backlinkCollapsed: {} })
  })

  test('reads ui state from vault-persist and applies to store', () => {
    const mockState = {
      backlinkCollapsed: { '/x.md': false },
      dismissedGhosts: [],
      outlineVisible: false
    }
    const spy = vi.spyOn(vaultPersist, 'getUiState').mockReturnValue(mockState)

    rehydrateUiStore()

    expect(useUiStore.getState().getBacklinkCollapsed('/x.md')).toBe(false)
    spy.mockRestore()
  })

  test('handles missing backlinkCollapsed gracefully', () => {
    const spy = vi.spyOn(vaultPersist, 'getUiState').mockReturnValue({
      backlinkCollapsed: {},
      dismissedGhosts: [],
      outlineVisible: false
    })

    rehydrateUiStore()

    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(true)
    spy.mockRestore()
  })
})
