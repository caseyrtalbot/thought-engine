import { useCanvasStore } from '../../store/canvas-store'
import { useTabStore } from '../../store/tab-store'
import { createCanvasNode } from '@shared/canvas-types'
import type { SystemArtifactListItem } from '../sidebar/Sidebar'
import type { SystemArtifactKind } from '@shared/system-artifacts'

/**
 * If the workbench tab is currently active, place a system artifact card
 * on the canvas near the viewport center. Returns true if a card was placed.
 */
export function placeArtifactOnWorkbench(item: SystemArtifactListItem): boolean {
  const activeTabId = useTabStore.getState().activeTabId
  if (activeTabId !== 'workbench') return false

  const store = useCanvasStore.getState()

  // Skip if this artifact is already on the canvas
  const alreadyPlaced = store.nodes.some(
    (n) => n.type === 'system-artifact' && n.metadata?.artifactId === item.id
  )
  if (alreadyPlaced) return true

  const { x, y, zoom } = store.viewport
  const viewCenterX = (-x + 400) / zoom
  const viewCenterY = (-y + 300) / zoom

  const node = createCanvasNode(
    'system-artifact',
    { x: viewCenterX, y: viewCenterY },
    {
      content: item.title,
      metadata: buildArtifactMetadata(item)
    }
  )

  store.addNode(node)
  return true
}

function buildArtifactMetadata(item: SystemArtifactListItem): Record<string, unknown> {
  return {
    artifactKind: item.type satisfies SystemArtifactKind,
    artifactId: item.id,
    status: item.status ?? '',
    filePath: item.path,
    signal: 'untested',
    fileRefCount: 0
  }
}
