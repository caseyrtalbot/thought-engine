import { describe, expect, it } from 'vitest'
import { normalizePersistedTabState } from '../tab-store'

describe('normalizePersistedTabState', () => {
  it('migrates legacy project canvas tabs to workbench', () => {
    const result = normalizePersistedTabState({
      tabs: [
        { id: 'editor', type: 'editor', label: 'Editor', closeable: false },
        {
          id: 'project-canvas',
          type: 'project-canvas',
          label: 'Project Canvas',
          closeable: true
        }
      ],
      activeTabId: 'project-canvas'
    })

    expect(result.activeTabId).toBe('workbench')
    expect(result.tabs).toContainEqual({
      id: 'workbench',
      type: 'workbench',
      label: 'Workbench',
      closeable: true
    })
  })

  it('restores missing default tabs when persisted state is empty', () => {
    const result = normalizePersistedTabState({ tabs: [], activeTabId: 'missing' })

    expect(result.tabs.map((tab) => tab.id)).toEqual(['editor', 'canvas'])
    expect(result.activeTabId).toBe('editor')
  })
})
