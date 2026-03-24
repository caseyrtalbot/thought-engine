import matter from 'gray-matter'
import { useCanvasStore } from '../../store/canvas-store'
import { useTabStore } from '../../store/tab-store'
import { createCanvasEdge, createCanvasNode } from '@shared/canvas-types'
import type { CanvasEdge, CanvasNode, SystemArtifactNodeMeta } from '@shared/canvas-types'
import type { SystemArtifactListItem } from '../sidebar/Sidebar'
import type { SystemArtifactKind } from '@shared/system-artifacts'

type ArtifactReader = (vaultPath: string, path: string) => Promise<string>

/**
 * If the workbench tab is currently active, place a system artifact card
 * on the canvas near the viewport center. Returns the placed node ID,
 * or null if placement was skipped.
 */
export function placeArtifactOnWorkbench(item: SystemArtifactListItem): string | null {
  const activeTabId = useTabStore.getState().activeTabId
  if (activeTabId !== 'workbench') return null

  const store = useCanvasStore.getState()

  // Skip if this artifact is already on the canvas
  const existing = store.nodes.find(
    (n) => n.type === 'system-artifact' && n.metadata?.artifactId === item.id
  )
  if (existing) return existing.id

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
  return node.id
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
    const snapshotVal = asString(frontmatter.canvas_snapshot)
    return {
      ...base,
      tensionRefs: patternTensionRefs,
      hasSnapshot: !!snapshotVal,
      snapshotPath: snapshotVal
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
 * based on connections and tensionRefs. Wires both directions:
 * - Outbound: new node's refs point to existing nodes
 * - Inbound: existing nodes' refs point to the new node
 * Deduplicates against edges already in the store.
 * Returns new edges (does not mutate the store).
 */
export function wireArtifactEdges(nodeId: string, store: CanvasStoreSnapshot): CanvasEdge[] {
  const sourceNode = store.nodes.find((n) => n.id === nodeId)
  if (!sourceNode || sourceNode.type !== 'system-artifact') return []

  const sourceMeta = sourceNode.metadata as Partial<SystemArtifactNodeMeta>
  const sourceArtifactId = sourceMeta.artifactId ?? ''

  // Build lookups
  const artifactIdToNode = new Map<string, CanvasNode>()
  for (const n of store.nodes) {
    if (n.type === 'system-artifact' && n.id !== nodeId) {
      const id = n.metadata?.artifactId as string | undefined
      if (id) artifactIdToNode.set(id, n)
    }
  }

  // Build dedup set from existing store edges
  const existingEdgeKeys = new Set<string>()
  for (const e of store.edges) {
    existingEdgeKeys.add(`${e.fromNode}:${e.toNode}:${e.kind ?? 'connection'}`)
  }

  const edges: CanvasEdge[] = []
  const seen = new Set<string>(existingEdgeKeys)

  function tryAddEdge(from: string, to: string, kind: 'connection' | 'tension') {
    const key = `${from}:${to}:${kind}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push(createCanvasEdge(from, to, 'right', 'left', kind))
  }

  // Outbound: new node's connections/tensionRefs → existing nodes
  for (const targetId of sourceMeta.connections ?? []) {
    const target = artifactIdToNode.get(targetId)
    if (target) tryAddEdge(nodeId, target.id, 'connection')
  }
  for (const targetId of sourceMeta.tensionRefs ?? []) {
    const target = artifactIdToNode.get(targetId)
    if (target) tryAddEdge(nodeId, target.id, 'tension')
  }

  // Inbound: existing nodes whose connections/tensionRefs reference the new node
  for (const [, otherNode] of artifactIdToNode) {
    const otherMeta = otherNode.metadata as Partial<SystemArtifactNodeMeta>
    for (const ref of otherMeta.connections ?? []) {
      if (ref === sourceArtifactId) tryAddEdge(otherNode.id, nodeId, 'connection')
    }
    for (const ref of otherMeta.tensionRefs ?? []) {
      if (ref === sourceArtifactId) tryAddEdge(otherNode.id, nodeId, 'tension')
    }
  }

  return edges
}

// --- Async enrichment (reads from disk, updates store) ---

const defaultReader: ArtifactReader = (vaultPath, path) =>
  window.api.vault.readSystemArtifact(vaultPath, path)

/**
 * After a card is placed with basic metadata, read the full markdown
 * from disk, parse frontmatter, update the node's metadata, and wire edges.
 */
export async function enrichPlacedArtifact(
  nodeId: string,
  item: SystemArtifactListItem,
  vaultPath: string,
  reader: ArtifactReader = defaultReader
): Promise<void> {
  let content: string
  try {
    content = await reader(vaultPath, item.path)
  } catch {
    return // IPC read failed, keep basic metadata
  }

  const store = useCanvasStore.getState()
  // Node may have been removed between placement and enrichment
  if (!store.nodes.some((n) => n.id === nodeId)) return

  const parsed = matter(content)
  const frontmatter = parsed.data as Readonly<Record<string, unknown>>
  const enriched = enrichArtifactMetadata(frontmatter, item.type, item.path)

  useCanvasStore.getState().updateNodeMetadata(nodeId, { ...enriched })

  // Wire edges to other artifacts already on canvas
  const updatedStore = useCanvasStore.getState()
  const edges = wireArtifactEdges(nodeId, updatedStore)
  for (const edge of edges) {
    useCanvasStore.getState().addEdge(edge)
  }
}

// --- Pattern snapshot restore ---

type FsReader = (path: string) => Promise<string>

const defaultFsReader: FsReader = (path) => window.api.fs.readFile(path)

/**
 * Load a pattern's saved canvas snapshot and merge its nodes/edges
 * into the current workbench canvas.
 */
export async function restorePatternSnapshot(
  snapshotPath: string,
  vaultPath: string,
  reader: FsReader = defaultFsReader
): Promise<void> {
  if (!snapshotPath) return

  const absolutePath = vaultPath + '/' + snapshotPath

  let content: string
  try {
    content = await reader(absolutePath)
  } catch {
    return // File missing or unreadable
  }

  const { deserializeCanvas } = await import('../canvas/canvas-io')
  const snapshot = deserializeCanvas(content)

  if (snapshot.nodes.length === 0 && snapshot.edges.length === 0) return

  // Deduplicate against existing nodes/edges by ID
  const store = useCanvasStore.getState()
  const existingNodeIds = new Set(store.nodes.map((n) => n.id))
  const existingEdgeIds = new Set(store.edges.map((e) => e.id))

  const newNodes = snapshot.nodes.filter((n) => !existingNodeIds.has(n.id))
  const newEdges = snapshot.edges.filter((e) => !existingEdgeIds.has(e.id))

  if (newNodes.length === 0 && newEdges.length === 0) return

  useCanvasStore.getState().addNodesAndEdges(newNodes, newEdges)
}
