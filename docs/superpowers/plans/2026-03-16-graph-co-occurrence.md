# Graph Co-occurrence Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skills available:** Use `superpowers:verification-before-completion` before claiming any task is done. Use `superpowers:test-driven-development` for TDD flow. Use `everything-claude-code:typescript-best-practices` when writing TypeScript.

**Goal:** Replace tag hub-and-spoke graph with direct file-to-file co-occurrence edges weighted by inverse term frequency, and polish the visual rendering.

**Architecture:** The graph builder computes a unified term set per file (tags + concepts, normalized to lowercase), then creates weighted co-occurrence edges between file pairs that share terms. Ghost and tag nodes are eliminated. The renderer switches to curved bezier edges with weight-mapped opacity, all-circle node shapes, and tuned physics defaults.

**Tech Stack:** TypeScript, D3.js force simulation, Canvas 2D, Vitest, Zustand

**Spec:** `docs/superpowers/specs/2026-03-16-graph-co-occurrence-design.md`

---

## Chunk 1: Data Model (graph-builder + types)

### Task 1: Update RELATIONSHIP_KINDS in types.ts

**Files:**
- Modify: `src/shared/types.ts:61-68`

- [ ] **Step 1: Update the RELATIONSHIP_KINDS array**

Replace `'concept'` and `'tag'` with `'co-occurrence'`:

```typescript
export const RELATIONSHIP_KINDS = [
  'connection',
  'cluster',
  'tension',
  'appears_in',
  'co-occurrence'
] as const
```

- [ ] **Step 2: Run typecheck to see what breaks**

Run: `npm run typecheck 2>&1 | head -40`
Expected: Errors in graph-builder.ts, graph-config.ts, graph-model.test.ts, graph-builder.test.ts (all files referencing old kinds). This is expected; we'll fix them in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "refactor: replace tag/concept edge kinds with co-occurrence"
```

---

### Task 2: Rewrite graph-builder.ts for co-occurrence edges

**Files:**
- Modify: `src/renderer/src/engine/graph-builder.ts`

This is the core change. The new builder:
1. Creates nodes only from artifacts (no tag nodes, no ghost nodes)
2. Builds a unified term set per file (tags + concepts, lowercase)
3. Computes term frequency across all files
4. Creates co-occurrence edges between file pairs sharing terms, weighted by inverse frequency
5. Skips terms used in 20+ files (too common)
6. Skips edges with total weight < 0.3
7. Skips co-occurrence edges between pairs that already have explicit frontmatter edges

- [ ] **Step 1: Rewrite the full file**

```typescript
import type {
  Artifact,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  RelationshipKind
} from '@shared/types'

/** Hard cap: terms appearing in this many files or more are skipped. */
const TERM_FREQ_CAP = 20

/** Minimum co-occurrence edge weight to include. */
const MIN_EDGE_WEIGHT = 0.3

/**
 * Build a unified term set for an artifact: tags + concepts, normalized to lowercase.
 * Deduplicates naturally via Set.
 */
function buildTermSet(artifact: Artifact): ReadonlySet<string> {
  const terms = new Set<string>()
  for (const tag of artifact.tags) terms.add(tag.toLowerCase())
  for (const concept of artifact.concepts) terms.add(concept.toLowerCase())
  return terms
}

export function buildGraph(artifacts: readonly Artifact[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>()
  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = []

  // Create nodes from artifacts only (no tag nodes, no ghost nodes)
  for (const a of artifacts) {
    nodes.set(a.id, {
      id: a.id,
      title: a.title,
      type: a.type,
      signal: a.signal,
      connectionCount: 0,
      tags: [...a.tags],
      created: a.created
    })
  }

  function edgeKey(source: string, target: string, kind: RelationshipKind): string {
    return kind === 'appears_in'
      ? `${source}->${target}:${kind}`
      : `${[source, target].sort().join('<->')}:${kind}`
  }

  function addEdge(source: string, target: string, kind: RelationshipKind): void {
    const key = edgeKey(source, target, kind)
    if (edgeSet.has(key)) return
    edgeSet.add(key)

    // Create placeholder node for missing frontmatter reference (not ghost, just missing)
    if (!nodes.has(target)) {
      nodes.set(target, {
        id: target,
        title: target,
        type: 'note',
        signal: 'untested',
        connectionCount: 0
      })
    }

    edges.push({ source, target, kind })
  }

  // Check if any explicit edge already exists between two nodes
  function hasExplicitEdge(source: string, target: string): boolean {
    const sorted = [source, target].sort()
    const pairKey = sorted.join('<->')
    for (const kind of ['connection', 'cluster', 'tension', 'appears_in'] as const) {
      const key = kind === 'appears_in' ? `${source}->${target}:${kind}` : `${pairKey}:${kind}`
      if (edgeSet.has(key)) return true
      if (kind === 'appears_in') {
        if (edgeSet.has(`${target}->${source}:${kind}`)) return true
      }
    }
    return false
  }

  // ── Phase 1: Explicit frontmatter edges ──
  for (const a of artifacts) {
    for (const id of a.connections) addEdge(a.id, id, 'connection')
    for (const id of a.clusters_with) addEdge(a.id, id, 'cluster')
    for (const id of a.tensions_with) addEdge(a.id, id, 'tension')
    for (const id of a.appears_in) addEdge(a.id, id, 'appears_in')
  }

  // ── Phase 2: Co-occurrence edges from shared terms ──

  // Build term sets and compute global term frequency
  const termSets = new Map<string, ReadonlySet<string>>()
  const termFreq = new Map<string, number>()

  for (const a of artifacts) {
    const terms = buildTermSet(a)
    termSets.set(a.id, terms)
    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1)
    }
  }

  // Invert: for each term, collect the artifact IDs that contain it
  const termToArtifacts = new Map<string, string[]>()
  for (const a of artifacts) {
    const terms = termSets.get(a.id)!
    for (const term of terms) {
      const freq = termFreq.get(term)!
      if (freq >= TERM_FREQ_CAP) continue // Skip overly common terms
      if (freq < 2) continue // Need at least 2 files to form an edge
      const list = termToArtifacts.get(term) ?? []
      list.push(a.id)
      termToArtifacts.set(term, list)
    }
  }

  // Accumulate edge weights between artifact pairs
  const pairWeights = new Map<string, number>()
  for (const [term, ids] of termToArtifacts) {
    const freq = termFreq.get(term)!
    const weight = 1 / Math.log2(freq)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pairKey = [ids[i], ids[j]].sort().join('<->')
        pairWeights.set(pairKey, (pairWeights.get(pairKey) ?? 0) + weight)
      }
    }
  }

  // Create co-occurrence edges above the minimum weight
  for (const [pairKey, weight] of pairWeights) {
    if (weight < MIN_EDGE_WEIGHT) continue
    const [a, b] = pairKey.split('<->')
    if (hasExplicitEdge(a, b)) continue
    addEdge(a, b, 'co-occurrence')
  }

  // ── Phase 3: Count connections per node ──
  const connectionCounts = new Map<string, number>()
  for (const edge of edges) {
    if (nodes.has(edge.source)) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1)
    }
    if (nodes.has(edge.target) && edge.kind !== 'appears_in') {
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1)
    }
  }

  const finalNodes = Array.from(nodes.values()).map((node) => ({
    ...node,
    connectionCount: connectionCounts.get(node.id) ?? 0
  }))

  return { nodes: finalNodes, edges }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.web.json --composite false 2>&1 | grep graph-builder`
Expected: No errors from graph-builder.ts (other files will still have errors)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/engine/graph-builder.ts
git commit -m "feat: rewrite graph-builder with co-occurrence edges"
```

---

### Task 3: Rewrite graph-builder tests

**Files:**
- Modify: `tests/engine/graph-builder.test.ts`

- [ ] **Step 1: Replace the entire test file**

```typescript
import { describe, it, expect } from 'vitest'
import { buildGraph } from '@engine/graph-builder'
import type { Artifact } from '@shared/types'

function makeArtifact(
  overrides: Partial<Artifact> & { id: string; title: string; type: Artifact['type'] }
): Artifact {
  return {
    created: '2026-03-12',
    modified: '2026-03-12',
    signal: 'untested',
    tags: [],
    connections: [],
    clusters_with: [],
    tensions_with: [],
    appears_in: [],
    concepts: [],
    body: '',
    ...overrides
  }
}

describe('buildGraph', () => {
  it('creates nodes from artifacts', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'Gene 1', type: 'gene' }),
      makeArtifact({ id: 'c1', title: 'Constraint 1', type: 'constraint' })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes[0].id).toBe('g1')
    expect(graph.nodes[0].type).toBe('gene')
  })

  it('does not create tag nodes', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', tags: ['strategy'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes.find((n) => n.type === 'tag')).toBeUndefined()
  })

  it('does not create ghost nodes', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', concepts: ['Nonexistent'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes.find((n) => n.id.startsWith('ghost:'))).toBeUndefined()
  })

  // --- Explicit frontmatter edges (unchanged behavior) ---

  it('creates connection edges', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', connections: ['g2'] }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene' })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toEqual({ source: 'g1', target: 'g2', kind: 'connection' })
  })

  it('creates cluster, tension, and appears_in edges', () => {
    const artifacts = [
      makeArtifact({
        id: 'g1', title: 'G1', type: 'gene',
        clusters_with: ['g2'], tensions_with: ['c1'], appears_in: ['i1']
      }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene' }),
      makeArtifact({ id: 'c1', title: 'C1', type: 'constraint' }),
      makeArtifact({ id: 'i1', title: 'Index', type: 'index' })
    ]
    const graph = buildGraph(artifacts)
    const kinds = graph.edges.map((e) => e.kind)
    expect(kinds).toContain('cluster')
    expect(kinds).toContain('tension')
    expect(kinds).toContain('appears_in')
  })

  it('deduplicates edges', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', connections: ['g2'] }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene', connections: ['g1'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(1)
  })

  it('counts connections correctly for node sizing', () => {
    const artifacts = [
      makeArtifact({ id: 'g1', title: 'G1', type: 'gene', connections: ['g2', 'g3'] }),
      makeArtifact({ id: 'g2', title: 'G2', type: 'gene', connections: ['g1'] }),
      makeArtifact({ id: 'g3', title: 'G3', type: 'gene' })
    ]
    const graph = buildGraph(artifacts)
    const g1 = graph.nodes.find((n) => n.id === 'g1')
    expect(g1!.connectionCount).toBe(2)
  })

  // --- Co-occurrence edge tests ---

  it('creates co-occurrence edges between files sharing a tag', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['rare-tag'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['rare-tag'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
    expect(coEdges[0].source).not.toBe(coEdges[0].target)
  })

  it('creates co-occurrence edges between files sharing a concept', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', concepts: ['strategy'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', concepts: ['strategy'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
  })

  it('deduplicates tag and concept with same word into one term', () => {
    // File A has tag #strategy, File B has concept <node>strategy</node>
    // They should connect via co-occurrence (same normalized term)
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['strategy'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', concepts: ['Strategy'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
  })

  it('does not create duplicate co-occurrence edge for same-word tag and concept in one file', () => {
    // Both files have tag #strategy AND concept strategy — should still be 1 edge
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['strategy'], concepts: ['strategy'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['strategy'], concepts: ['strategy'] })
    ]
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(1)
  })

  it('skips co-occurrence for terms used in 20+ files', () => {
    // Create 20 artifacts all sharing the same tag
    const artifacts = Array.from({ length: 20 }, (_, i) =>
      makeArtifact({ id: `n${i}`, title: `Note ${i}`, type: 'note', tags: ['common'] })
    )
    const graph = buildGraph(artifacts)
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges).toHaveLength(0)
  })

  it('does not create co-occurrence when explicit frontmatter edge exists', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', connections: ['b'], tags: ['shared'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['shared'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].kind).toBe('connection')
  })

  it('weights edges higher for rare shared terms', () => {
    // 2 files share "rare" (weight = 1/log2(2) = 1.0) → passes threshold
    // 5 files share "common" (weight = 1/log2(5) ≈ 0.43) → still passes
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['rare'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['rare'] }),
      makeArtifact({ id: 'c', title: 'C', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'd', title: 'D', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'e', title: 'E', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'f', title: 'F', type: 'note', tags: ['medium'] }),
      makeArtifact({ id: 'g', title: 'G', type: 'note', tags: ['medium'] })
    ]
    const graph = buildGraph(artifacts)
    // "rare" (freq=2): 1 edge (a-b), weight 1.0
    // "medium" (freq=5): C(5,2)=10 pairs, weight 0.43 each → all pass 0.3 threshold
    const coEdges = graph.edges.filter((e) => e.kind === 'co-occurrence')
    expect(coEdges.length).toBe(11) // 1 + 10
  })

  it('creates no co-occurrence edges for file with single unique tag', () => {
    const artifacts = [
      makeArtifact({ id: 'a', title: 'A', type: 'note', tags: ['unique-a'] }),
      makeArtifact({ id: 'b', title: 'B', type: 'note', tags: ['unique-b'] })
    ]
    const graph = buildGraph(artifacts)
    expect(graph.edges).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- tests/engine/graph-builder.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/engine/graph-builder.test.ts
git commit -m "test: rewrite graph-builder tests for co-occurrence edges"
```

---

## Chunk 2: Graph Config, Model & Settings

### Task 4: Update graph-config.ts

**Files:**
- Modify: `src/renderer/src/panels/graph/graph-config.ts:65-101`

- [ ] **Step 1: Update GRAPH_PALETTE (remove tag-specific colors)**

```typescript
export const GRAPH_PALETTE = {
  canvasBg: '#0a0a12',
  defaultNote: '#8a8a9e',
  visitedNote: '#b8a9c9',
  defaultTag: '#e6a237',       // Keep for group rule fallback
  defaultAttach: '#6b7280',
  linkDefault: 'rgba(180, 170, 210, 0.06)',  // Softer lavender base
  linkActive: 'rgba(232, 229, 240, 0.8)',
  linkGlow: 'rgba(210, 208, 220, 0.25)',
  linkDimmed: 'rgba(255, 255, 255, 0)',
  labelColor: 'rgba(255, 255, 255, 0.7)',
  selectedRing: '#2dd4bf',
  tagStroke: '#e6a237',
  vignetteEdge: 'rgba(0, 0, 0, 0.4)'
} as const
```

- [ ] **Step 2: Update LINK_STRENGTH (remove tag/concept, add co-occurrence)**

```typescript
export const LINK_STRENGTH: Record<RelationshipKind, number> = {
  connection: 0.3,
  cluster: 0.6,
  tension: -0.2,
  appears_in: 0.2,
  'co-occurrence': 0.15
}
```

- [ ] **Step 3: Update DEFAULT_SIM_CONFIG**

```typescript
export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  centerForce: 0.03,
  repelForce: -200,
  linkForce: 0.5,
  linkDistance: 80
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/panels/graph/graph-config.ts
git commit -m "refactor: update graph config for co-occurrence model"
```

---

### Task 5: Update graph-model.ts (remove tag/attachment filters)

**Files:**
- Modify: `src/renderer/src/panels/graph/graph-model.ts`

- [ ] **Step 1: Simplify GraphFilters and applyFilters**

Remove `showTags` and `showAttachments` from `GraphFilters`. Remove the corresponding filter lines in `applyFilters`:

```typescript
export interface GraphFilters {
  showOrphans: boolean
  showExistingOnly: boolean
  searchQuery: string
}

function applyFilters(nodes: readonly GraphNode[], edges: readonly GraphEdge[], filters: GraphFilters): GraphModel {
  let filteredNodes = nodes.filter((node) => {
    if (filters.showExistingOnly && node.id.startsWith('ghost:')) return false
    return true
  })

  const survivingIds = new Set(filteredNodes.map(getNodeId))

  const filteredEdges = edges.filter((edge) => {
    const sourceId = String(edge.source)
    const targetId = String(edge.target)
    return survivingIds.has(sourceId) && survivingIds.has(targetId)
  })

  if (!filters.showOrphans) {
    const connectedIds = new Set<string>()
    for (const edge of filteredEdges) {
      connectedIds.add(String(edge.source))
      connectedIds.add(String(edge.target))
    }

    filteredNodes = filteredNodes.filter((node) => {
      return connectedIds.has(node.id) || node.connectionCount > 0
    })
  }

  return { nodes: filteredNodes, edges: filteredEdges }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/panels/graph/graph-model.ts
git commit -m "refactor: remove tag/attachment filters from graph model"
```

---

### Task 6: Update graph-settings-store.ts

**Files:**
- Modify: `src/renderer/src/store/graph-settings-store.ts`

- [ ] **Step 1: Remove showTags/showAttachments, add minEdgeWeight, update force defaults**

Remove from interface: `showTags`, `showAttachments`, `setShowTags`, `setShowAttachments`
Add to interface: `minEdgeWeight: number`, `setMinEdgeWeight: (value: number) => void`
Update force defaults to match new physics.

In the `create` call:
- Remove `showTags: true` and `showAttachments: true` and their setters
- Add `minEdgeWeight: 0.3` and its setter
- Change `centerForce: 0.03`, `repelForce: -200`, `linkForce: 0.5`, `linkDistance: 80`

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/store/graph-settings-store.ts
git commit -m "refactor: update graph settings for co-occurrence model"
```

---

### Task 7: Update graph-model tests

**Files:**
- Modify: `tests/graph/graph-model.test.ts`

- [ ] **Step 1: Update test fixtures and filters**

Remove `showTags` and `showAttachments` from `defaultFilters`. Remove `t1` (tag node) and `a1` (attachment node) from test graph. Remove tests for tag/attachment filtering. Update local graph BFS tests accordingly.

The new `defaultFilters`:
```typescript
const defaultFilters: GraphFilters = {
  showOrphans: true,
  showExistingOnly: false,
  searchQuery: ''
}
```

The new `makeGraph`:
```typescript
function makeGraph(): KnowledgeGraph {
  return {
    nodes: [
      { id: 'n1', title: 'Note 1', type: 'note', signal: 'untested', connectionCount: 2 },
      { id: 'n2', title: 'Note 2', type: 'note', signal: 'emerging', connectionCount: 1 },
      { id: 'n3', title: 'Note 3', type: 'note', signal: 'validated', connectionCount: 1 },
      { id: 'n4', title: 'Note 4', type: 'note', signal: 'untested', connectionCount: 1 },
      { id: 'orphan', title: 'Orphan', type: 'note', signal: 'untested', connectionCount: 0 }
    ],
    edges: [
      { source: 'n1', target: 'n2', kind: 'connection' },
      { source: 'n1', target: 'n3', kind: 'co-occurrence' },
      { source: 'n3', target: 'n4', kind: 'connection' }
    ]
  }
}
```

Update all test assertions to match. Remove the tag/attachment filter tests. Keep orphan, existing-only, local graph BFS, and immutability tests.

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/graph/graph-model.test.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add tests/graph/graph-model.test.ts
git commit -m "test: update graph-model tests for co-occurrence model"
```

---

## Chunk 3: Visual Rendering Polish

### Task 8: Update GraphRenderer.ts (curved edges, remove diamond/square)

**Files:**
- Modify: `src/renderer/src/panels/graph/GraphRenderer.ts`

- [ ] **Step 1: Remove drawTagNode and drawAttachmentNode functions**

Delete the `drawTagNode` and `drawAttachmentNode` functions (lines 242-258). Simplify `drawNodeShape` to always call `drawNoteNode`:

```typescript
function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  _node: SimNode,
  x: number,
  y: number,
  r: number
): void {
  drawNoteNode(ctx, x, y, r)
}
```

- [ ] **Step 2: Replace straight-line edge rendering with quadratic bezier curves**

In Stage 1 (edges), replace `ctx.lineTo` with curved paths. For both highlighted and idle modes, use a helper:

```typescript
function drawCurvedEdge(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  tx: number, ty: number
): void {
  // Control point offset perpendicular to midpoint
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2
  const dx = tx - sx
  const dy = ty - sy
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return
  // Offset 8% of length perpendicular
  const offset = len * 0.08
  const nx = -dy / len
  const ny = dx / len
  ctx.moveTo(sx, sy)
  ctx.quadraticCurveTo(mx + nx * offset, my + ny * offset, tx, ty)
}
```

Replace in the highlight edge loop:
```typescript
// Before: ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y)
// After:
drawCurvedEdge(ctx, source.x, source.y, target.x, target.y)
```

Same replacement in the idle edge loop.

- [ ] **Step 3: Change idle edge opacity from 0.04 to weight-mapped range**

Replace the idle edge rendering block. Instead of a single alpha for all edges, use varied opacity:

```typescript
// Normal mode: edges with varied opacity based on kind
ctx.setLineDash([])
for (const edge of edges) {
  const source = edge.source as SimNode
  const target = edge.target as SimNode
  if (!hasValidCoords(source) || !hasValidCoords(target)) continue
  const isCo = edge.kind === 'co-occurrence'
  ctx.globalAlpha = isCo ? 0.06 : 0.12
  ctx.strokeStyle = 'rgba(180, 170, 210, 1)'
  ctx.lineWidth = (isCo ? 0.5 : 0.8) * linkThickness
  ctx.beginPath()
  drawCurvedEdge(ctx, source.x, source.y, target.x, target.y)
  ctx.stroke()
}
```

- [ ] **Step 4: Remove tag-specific stroke ring from Stage 4 bright pass**

In the bright pass loop (around line 516-527), remove the `if (vn.node.type === 'tag')` blocks that add `tagStroke`. All nodes are circles now.

- [ ] **Step 5: Add subtle outer ring for well-connected nodes**

After the bright pass fill/stroke, add:

```typescript
// Outer ring for well-connected nodes
for (const vn of visibleNodes) {
  if (vn.isDimmed) continue
  if (vn.node.connectionCount > 8) {
    ctx.globalAlpha = 0.15
    ctx.strokeStyle = vn.color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(vn.node.x, vn.node.y, vn.r + 3, 0, Math.PI * 2)
    ctx.stroke()
  }
}
ctx.globalAlpha = 1
```

- [ ] **Step 6: Update resolveNodeColor to remove tag/attachment special cases**

```typescript
export function resolveNodeColor(node: SimNode): string {
  if (node._color) return node._color
  if (node._visited) return GRAPH_PALETTE.visitedNote
  return GRAPH_PALETTE.defaultNote
}
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/panels/graph/GraphRenderer.ts
git commit -m "feat: curved edges, weight-mapped opacity, remove diamond shapes"
```

---

### Task 9: Update GraphSettingsPanel.tsx (remove tag/attachment toggles, add min-weight)

**Files:**
- Modify: `src/renderer/src/panels/graph/GraphSettingsPanel.tsx`

- [ ] **Step 1: Remove Tags and Attachments toggles from the filters section**

Remove the store selectors for `showTags`, `setShowTags`, `showAttachments`, `setShowAttachments` (lines 230-233).

Remove the two `<TogglePill>` components for "Tags" and "Attachments" from the JSX (lines 358-366).

- [ ] **Step 2: Add minEdgeWeight slider to Display section**

Add store selector:
```typescript
const minEdgeWeight = useGraphSettingsStore((s) => s.minEdgeWeight)
const setMinEdgeWeight = useGraphSettingsStore((s) => s.setMinEdgeWeight)
```

Add slider in the Display section (after Link thickness):
```typescript
<SliderRow
  label="Min edge weight"
  value={minEdgeWeight}
  min={0.1}
  max={1.0}
  step={0.05}
  onChange={setMinEdgeWeight}
/>
```

- [ ] **Step 3: Cap link thickness slider max at 2.0**

Change line 464: `max={3}` to `max={2}`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/panels/graph/GraphSettingsPanel.tsx
git commit -m "feat: update settings panel for co-occurrence model"
```

---

### Task 10: Update GraphMinimap.tsx (remove tag colors)

**Files:**
- Modify: `src/renderer/src/panels/graph/GraphMinimap.tsx`

- [ ] **Step 1: Simplify getNodeDotColor**

```typescript
function getNodeDotColor(node: SimNode): string {
  if (node._color) return node._color
  return DEFAULT_NOTE_COLOR
}
```

Remove the `DEFAULT_TAG_COLOR` constant.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/panels/graph/GraphMinimap.tsx
git commit -m "refactor: simplify minimap node colors"
```

---

## Chunk 4: Fix Remaining References & Verify

### Task 11: Fix all remaining type errors and references

**Files:**
- Modify: `src/renderer/src/panels/graph/GraphPanel.tsx` (if it references showTags/showAttachments in filter construction)
- Modify: any other files that reference the old GraphFilters shape

- [ ] **Step 1: Find all files referencing showTags or showAttachments**

Run: `grep -rn "showTags\|showAttachments" src/ tests/ --include="*.ts" --include="*.tsx"`

Fix each file by removing those properties from filter objects.

- [ ] **Step 2: Find all remaining references to 'tag' or 'concept' as edge kinds**

Run: `grep -rn "kind.*tag\|kind.*concept\|'tag'\|'concept'" src/ tests/ --include="*.ts" --include="*.tsx"`

Fix any remaining references (likely in GraphPanel.tsx filter construction).

- [ ] **Step 3: Run full typecheck**

Run: `npm run typecheck`
Expected: Only the pre-existing App.tsx readonly error

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve all remaining type errors from co-occurrence migration"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: Only pre-existing App.tsx error

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All pass

- [ ] **Step 3: Start the app**

Run: `npm run dev`
Expected: App starts without errors. Graph shows organic clustering with file nodes only (no diamonds). Edges are curved and subtle. Dense rectangular grid is gone.

- [ ] **Step 4: Report results**

Report: test count, any failures, app startup status. Request user to take screenshots for visual verification.
