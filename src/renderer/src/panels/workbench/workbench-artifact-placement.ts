import { useCanvasStore } from '../../store/canvas-store'
import { useTabStore } from '../../store/tab-store'
import { createCanvasEdge, createCanvasNode } from '@shared/canvas-types'
import type { CanvasEdge, CanvasNode, SystemArtifactNodeMeta } from '@shared/canvas-types'
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
      metadata: buildBasicMetadata(item)
    }
  )

  store.addNode(node)
  return true
}

function buildBasicMetadata(item: SystemArtifactListItem): Record<string, unknown> {
  return {
    artifactKind: item.type satisfies SystemArtifactKind,
    artifactId: item.id,
    status: item.status ?? '',
    filePath: item.path,
    signal: 'untested',
    fileRefCount: 0,
    connections: [],
    tensionRefs: []
  }
}

// --- Enrichment (pure, testable) ---

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function uniqueStrings(arrays: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const arr of arrays) {
    for (const v of arr) {
      if (!seen.has(v)) {
        seen.add(v)
        result.push(v)
      }
    }
  }
  return result
}

/**
 * Build enriched metadata from raw frontmatter (as parsed by gray-matter).
 * Pure function: no IPC, no side effects.
 */
export function enrichArtifactMetadata(
  frontmatter: Readonly<Record<string, unknown>>,
  kind: SystemArtifactKind,
  filePath: string
): SystemArtifactNodeMeta {
  const connections = asStringArray(frontmatter.connections)
  const tensionsWith = asStringArray(frontmatter.tensions_with)
  const tensionRefsField = asStringArray(frontmatter.tension_refs)
  const patternRefsField = asStringArray(frontmatter.pattern_refs)

  // Merge tensions_with + tension_refs + pattern_refs that are tension IDs
  const allTensionRefs = uniqueStrings([tensionsWith, tensionRefsField])

  const base: SystemArtifactNodeMeta = {
    artifactKind: kind,
    artifactId: asString(frontmatter.id) ?? '',
    status: asString(frontmatter.status) ?? '',
    filePath,
    summary: asString(frontmatter.summary),
    signal: asString(frontmatter.signal) ?? 'untested',
    fileRefCount: asStringArray(frontmatter.file_refs).length,
    connections,
    tensionRefs: allTensionRefs
  }

  if (kind === 'session') {
    return {
      ...base,
      commandCount: asNumber(frontmatter.command_count),
      fileTouchCount: asNumber(frontmatter.file_touch_count)
    }
  }

  if (kind === 'tension') {
    return {
      ...base,
      question: asString(frontmatter.question)
    }
  }

  if (kind === 'pattern') {
    // Merge pattern_refs into tensionRefs if they reference tensions
    const patternTensionRefs = uniqueStrings([allTensionRefs, patternRefsField])
    return {
      ...base,
      tensionRefs: patternTensionRefs,
      hasSnapshot:
        typeof frontmatter.canvas_snapshot === 'string' && frontmatter.canvas_snapshot.length > 0
    }
  }

  return base
}

// --- Edge wiring (pure, testable) ---

interface CanvasStoreSnapshot {
  readonly nodes: readonly CanvasNode[]
  readonly edges: readonly CanvasEdge[]
}

/**
 * Given a just-placed artifact node ID, compute edges to other artifact nodes
 * that appear in its connections or tensionRefs.
 * Returns new edges (does not mutate the store).
 */
export function wireArtifactEdges(nodeId: string, store: CanvasStoreSnapshot): CanvasEdge[] {
  const sourceNode = store.nodes.find((n) => n.id === nodeId)
  if (!sourceNode || sourceNode.type !== 'system-artifact') return []

  const meta = sourceNode.metadata as Partial<SystemArtifactNodeMeta>
  const connections = meta.connections ?? []
  const tensionRefs = meta.tensionRefs ?? []

  // Build a lookup: artifactId → canvas node id
  const artifactIdToNodeId = new Map<string, string>()
  for (const n of store.nodes) {
    if (n.type === 'system-artifact' && n.id !== nodeId) {
      const id = n.metadata?.artifactId as string | undefined
      if (id) artifactIdToNodeId.set(id, n.id)
    }
  }

  const edges: CanvasEdge[] = []
  const seen = new Set<string>()

  for (const targetArtifactId of connections) {
    const targetNodeId = artifactIdToNodeId.get(targetArtifactId)
    if (!targetNodeId) continue
    const key = `connection:${targetNodeId}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push(createCanvasEdge(nodeId, targetNodeId, 'right', 'left', 'connection'))
  }

  for (const targetArtifactId of tensionRefs) {
    const targetNodeId = artifactIdToNodeId.get(targetArtifactId)
    if (!targetNodeId) continue
    const key = `tension:${targetNodeId}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push(createCanvasEdge(nodeId, targetNodeId, 'right', 'left', 'tension'))
  }

  return edges
}
