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
    useUiStore.getState().rehydrate({
      '/notes/a.md': false,
      '/notes/b.md': true
    })
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(false)
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/b.md')).toBe(true)
  })

  test('rehydrate with empty object resets to defaults', () => {
    useUiStore.getState().toggleBacklinkCollapsed('/notes/a.md')
    useUiStore.getState().rehydrate({})
    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(true)
  })
})

describe('rehydrateUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ backlinkCollapsed: {} })
  })

  test('reads ui state from vault-persist and applies to store', () => {
    const mockState = { backlinkCollapsed: { '/x.md': false } }
    const spy = vi.spyOn(vaultPersist, 'getUiState').mockReturnValue(mockState)

    rehydrateUiStore()

    expect(useUiStore.getState().getBacklinkCollapsed('/x.md')).toBe(false)
    spy.mockRestore()
  })

  test('handles missing backlinkCollapsed gracefully', () => {
    const spy = vi.spyOn(vaultPersist, 'getUiState').mockReturnValue({ backlinkCollapsed: {} })

    rehydrateUiStore()

    expect(useUiStore.getState().getBacklinkCollapsed('/notes/a.md')).toBe(true)
    spy.mockRestore()
  })
})
