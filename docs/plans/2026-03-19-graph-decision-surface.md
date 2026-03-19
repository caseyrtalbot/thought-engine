# Graph Decision Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PixiJS WebGL knowledge graph that serves as an orientation and decision surface, matching Obsidian's quality bar for physics, interaction, and visual polish.

**Architecture:** PixiJS WebGL renders nodes and edges on the GPU. d3-force runs physics in a Web Worker, posting Float32Array positions via `postMessage` with transfer. A Canvas 2D overlay renders labels at native text quality. A React shell (GraphPanel) bridges vault-store graph data to the worker and manages lifecycle. The graph is a new ContentView peer to editor/canvas/skills, completely independent of the existing canvas infrastructure.

**Tech Stack:** PixiJS 8.x (WebGL renderer), d3-force (physics simulation), d3-quadtree (spatial indexing), Zustand (state), React 19, TypeScript strict mode.

**Deconfliction with Canvas Work:** The graph panel is a completely separate rendering system. It does NOT use canvas-store, CanvasView, CanvasSurface, EdgeLayer, or the store-swap pattern. It reads from vault-store.graph (read-only) and navigates via editor-store. The only shared touchpoints are view-store.ts (new ContentView value) and App.tsx (new conditional render). Zero conflict with ongoing canvas panel work.

---

## File Structure

### New Files

```
src/renderer/src/panels/graph/
├── GraphPanel.tsx               # React shell: lifecycle, keyboard, layout
├── graph-renderer.ts            # PixiJS Application, node/edge containers, render loop
├── graph-interactions.ts        # (merged into graph-renderer.ts — interactions are tightly coupled to renderer internals)
├── graph-label-layer.ts         # Canvas 2D overlay for text labels
├── graph-theme-bridge.ts        # CSS → PixiJS color bridge (Obsidian pattern)
├── graph-lod.ts                 # Level-of-detail decisions per zoom level
├── graph-types.ts               # Internal types for the graph renderer

src/renderer/src/engine/
├── graph-physics-worker.ts      # Web Worker: d3-force simulation

src/renderer/src/store/
├── graph-view-store.ts          # Zustand store for graph panel state

tests/graph/
├── graph-physics-worker.test.ts # Worker message protocol tests
├── graph-view-store.test.ts     # Store state management tests
├── graph-theme-bridge.test.ts   # Color conversion tests
├── graph-lod.test.ts            # LOD level decision tests
├── graph-renderer.test.ts       # Renderer lifecycle tests
```

### Modified Files

```
package.json                              # Add pixi.js, d3-force, d3-quadtree
electron.vite.config.ts                   # Add pixi.js to optimizeDeps
src/renderer/src/store/view-store.ts      # Add 'graph' to ContentView union
src/renderer/src/App.tsx                  # Add GraphPanel conditional render + Cmd+Shift+G shortcut
src/shared/types.ts                       # Add x/y to GraphNode (already has optional x/y)
```

---

## Task 1: Dependencies + Internal Types

**Files:**
- Modify: `package.json`
- Modify: `electron.vite.config.ts`
- Create: `src/renderer/src/panels/graph/graph-types.ts`

- [ ] **Step 1: Install PixiJS and D3 force modules**

```bash
cd /Users/caseytalbot/Projects/thought-engine
npm install --cache /tmp/npm-cache-te pixi.js d3-force d3-quadtree
npm install --cache /tmp/npm-cache-te -D @types/d3-force @types/d3-quadtree
```

- [ ] **Step 2: Add pixi.js to Vite optimizeDeps**

In `electron.vite.config.ts`, add `'pixi.js'` to the `optimizeDeps.include` array alongside the existing d3 entries.

- [ ] **Step 3: Create graph-types.ts**

```typescript
// src/renderer/src/panels/graph/graph-types.ts
import type { ArtifactType, RelationshipKind, Signal } from '@shared/types'

/** A simulation node with physics position and velocity. */
export interface SimNode {
  readonly index: number
  readonly id: string
  readonly type: ArtifactType
  readonly signal: Signal
  readonly connectionCount: number
  readonly isGhost: boolean
}

/** Compact position buffer layout: [x0, y0, x1, y1, ...] */
export type PositionBuffer = Float32Array

/** Messages from main thread → physics worker */
export type PhysicsCommand =
  | { type: 'init'; nodes: SimNode[]; edges: ReadonlyArray<{ source: number; target: number; kind: RelationshipKind }> }
  | { type: 'tick' }
  | { type: 'drag'; nodeIndex: number; x: number; y: number }
  | { type: 'drag-end'; nodeIndex: number }
  | { type: 'pin'; nodeIndex: number; x: number; y: number }
  | { type: 'unpin'; nodeIndex: number }
  | { type: 'reheat'; alpha?: number }
  | { type: 'stop' }
  | { type: 'resume' }
  | { type: 'update-params'; params: Partial<ForceParams> }

/** Messages from physics worker → main thread */
export type PhysicsResult =
  | { type: 'positions'; buffer: Float32Array; alpha: number; settled: boolean }
  | { type: 'ready' }
  | { type: 'error'; message: string }

/** Tunable force parameters (Obsidian-inspired defaults) */
export interface ForceParams {
  readonly centerStrength: number   // 0.48 — gravity toward center
  readonly repelStrength: number    // -250 — many-body repulsion (negative = repel)
  readonly linkStrength: number     // 0.4 — spring stiffness
  readonly linkDistance: number     // 180 — target edge length in px
  readonly velocityDecay: number    // 0.4 — atmospheric friction
  readonly alphaDecay: number       // 0.02 — cooling rate
  readonly alphaMin: number         // 0.001 — convergence threshold
}

export const DEFAULT_FORCE_PARAMS: ForceParams = {
  centerStrength: 0.48,
  repelStrength: -250,
  linkStrength: 0.4,
  linkDistance: 180,
  velocityDecay: 0.4,
  alphaDecay: 0.02,
  alphaMin: 0.001
}

/** LOD tiers for zoom-based rendering */
export type LodLevel = 'micro' | 'meso' | 'macro'

/** Graph viewport state */
export interface GraphViewport {
  readonly x: number
  readonly y: number
  readonly scale: number
}

/** Resolved theme colors for PixiJS rendering */
export interface GraphThemeColors {
  readonly background: number
  readonly nodeFill: number
  readonly nodeFillFocused: number
  readonly nodeFillGhost: number
  readonly nodeStroke: number
  readonly edge: number
  readonly edgeHighlight: number
  readonly labelText: number
  readonly labelTextDim: number
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: No errors related to new types.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json electron.vite.config.ts src/renderer/src/panels/graph/graph-types.ts
git commit -m "feat(graph): add PixiJS/d3-force deps and graph internal types"
```

---

## Task 2: Graph View Store

**Files:**
- Create: `src/renderer/src/store/graph-view-store.ts`
- Create: `tests/graph/graph-view-store.test.ts`
- Modify: `src/renderer/src/store/view-store.ts`

- [ ] **Step 1: Write failing tests for graph-view-store**

```typescript
// tests/graph/graph-view-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphViewStore } from '@renderer/store/graph-view-store'

describe('graph-view-store', () => {
  beforeEach(() => {
    useGraphViewStore.getState().reset()
  })

  it('initializes with no hovered or selected node', () => {
    const state = useGraphViewStore.getState()
    expect(state.hoveredNodeId).toBeNull()
    expect(state.selectedNodeId).toBeNull()
    expect(state.alpha).toBe(0)
    expect(state.settled).toBe(true)
  })

  it('sets and clears hovered node', () => {
    useGraphViewStore.getState().setHoveredNode('node-1')
    expect(useGraphViewStore.getState().hoveredNodeId).toBe('node-1')
    useGraphViewStore.getState().setHoveredNode(null)
    expect(useGraphViewStore.getState().hoveredNodeId).toBeNull()
  })

  it('sets and clears selected node', () => {
    useGraphViewStore.getState().setSelectedNode('node-2')
    expect(useGraphViewStore.getState().selectedNodeId).toBe('node-2')
    useGraphViewStore.getState().setSelectedNode(null)
    expect(useGraphViewStore.getState().selectedNodeId).toBeNull()
  })

  it('tracks simulation alpha and settled state', () => {
    useGraphViewStore.getState().setSimulationState(0.5, false)
    const s = useGraphViewStore.getState()
    expect(s.alpha).toBe(0.5)
    expect(s.settled).toBe(false)
  })

  it('stores viewport state', () => {
    useGraphViewStore.getState().setViewport({ x: 100, y: 200, scale: 1.5 })
    const vp = useGraphViewStore.getState().viewport
    expect(vp).toEqual({ x: 100, y: 200, scale: 1.5 })
  })

  it('tracks node count and edge count', () => {
    useGraphViewStore.getState().setGraphStats(42, 87)
    const s = useGraphViewStore.getState()
    expect(s.nodeCount).toBe(42)
    expect(s.edgeCount).toBe(87)
  })

  it('reset clears all state', () => {
    useGraphViewStore.getState().setHoveredNode('x')
    useGraphViewStore.getState().setSelectedNode('y')
    useGraphViewStore.getState().setSimulationState(0.8, false)
    useGraphViewStore.getState().reset()
    const s = useGraphViewStore.getState()
    expect(s.hoveredNodeId).toBeNull()
    expect(s.selectedNodeId).toBeNull()
    expect(s.alpha).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/graph/graph-view-store.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement graph-view-store**

```typescript
// src/renderer/src/store/graph-view-store.ts
import { create } from 'zustand'
import type { GraphViewport } from '@renderer/panels/graph/graph-types'

interface GraphViewState {
  readonly hoveredNodeId: string | null
  readonly selectedNodeId: string | null
  readonly viewport: GraphViewport
  readonly alpha: number
  readonly settled: boolean
  readonly nodeCount: number
  readonly edgeCount: number
  readonly showLabels: boolean
  readonly showGhostNodes: boolean

  setHoveredNode: (id: string | null) => void
  setSelectedNode: (id: string | null) => void
  setViewport: (viewport: GraphViewport) => void
  setSimulationState: (alpha: number, settled: boolean) => void
  setGraphStats: (nodeCount: number, edgeCount: number) => void
  setShowLabels: (show: boolean) => void
  setShowGhostNodes: (show: boolean) => void
  reset: () => void
}

const INITIAL_STATE = {
  hoveredNodeId: null as string | null,
  selectedNodeId: null as string | null,
  viewport: { x: 0, y: 0, scale: 1 } as GraphViewport,
  alpha: 0,
  settled: true,
  nodeCount: 0,
  edgeCount: 0,
  showLabels: true,
  showGhostNodes: true
}

export const useGraphViewStore = create<GraphViewState>((set) => ({
  ...INITIAL_STATE,

  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setViewport: (viewport) => set({ viewport }),
  setSimulationState: (alpha, settled) => set({ alpha, settled }),
  setGraphStats: (nodeCount, edgeCount) => set({ nodeCount, edgeCount }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowGhostNodes: (show) => set({ showGhostNodes: show }),
  reset: () => set(INITIAL_STATE)
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/graph/graph-view-store.test.ts
```

Expected: All 7 tests PASS

- [ ] **Step 5: Add 'graph' to ContentView in view-store**

In `src/renderer/src/store/view-store.ts`, change line 3:

```typescript
// Before:
export type ContentView = 'editor' | 'canvas' | 'skills' | 'claude-config' | 'project-canvas'

// After:
export type ContentView = 'editor' | 'canvas' | 'skills' | 'claude-config' | 'project-canvas' | 'graph'
```

Add a toggle method after `toggleProjectCanvas`:

```typescript
toggleGraph: () => {
  const current = get().contentView
  if (current === 'graph') {
    const prev = get().previousView ?? 'editor'
    set({ contentView: prev, previousView: 'graph' })
  } else {
    set({ contentView: 'graph', previousView: current })
  }
}
```

Update the `ViewStore` interface to include `toggleGraph: () => void`.

- [ ] **Step 6: Run full test suite to verify no regressions**

```bash
npm test
```

Expected: All existing tests pass, plus 7 new graph-view-store tests.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/store/graph-view-store.ts tests/graph/graph-view-store.test.ts src/renderer/src/store/view-store.ts
git commit -m "feat(graph): add graph view store and ContentView integration"
```

---

## Task 3: Physics Worker

**Files:**
- Create: `src/renderer/src/engine/graph-physics-worker.ts`
- Create: `tests/graph/graph-physics-worker.test.ts`

- [ ] **Step 1: Write failing tests for the physics worker message protocol**

```typescript
// tests/graph/graph-physics-worker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the worker logic directly by importing the handler function,
// not by spawning an actual Worker (vitest runs in Node, not browser).
// The worker file exports a handleMessage function for testability.
import { createPhysicsEngine } from '@engine/graph-physics-worker'
import type { SimNode } from '@renderer/panels/graph/graph-types'

function makeNodes(count: number): SimNode[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    id: `node-${i}`,
    type: 'note' as const,
    signal: 'untested' as const,
    connectionCount: 0,
    isGhost: false
  }))
}

describe('graph-physics-engine', () => {
  it('creates an engine and returns ready state', () => {
    const engine = createPhysicsEngine()
    expect(engine).toBeDefined()
    expect(typeof engine.init).toBe('function')
    expect(typeof engine.tick).toBe('function')
    expect(typeof engine.drag).toBe('function')
  })

  it('initializes with nodes and produces positions', () => {
    const engine = createPhysicsEngine()
    const nodes = makeNodes(5)
    const edges = [{ source: 0, target: 1, kind: 'connection' as const }]
    engine.init(nodes, edges)
    const result = engine.tick()
    expect(result.buffer).toBeInstanceOf(Float32Array)
    expect(result.buffer.length).toBe(10) // 5 nodes * 2 (x,y)
    expect(typeof result.alpha).toBe('number')
    expect(typeof result.settled).toBe('boolean')
  })

  it('positions are finite numbers after init', () => {
    const engine = createPhysicsEngine()
    engine.init(makeNodes(3), [])
    const result = engine.tick()
    for (let i = 0; i < result.buffer.length; i++) {
      expect(Number.isFinite(result.buffer[i])).toBe(true)
    }
  })

  it('drag pins a node at the given position', () => {
    const engine = createPhysicsEngine()
    engine.init(makeNodes(3), [])
    engine.drag(0, 500, 500)
    const result = engine.tick()
    // Node 0 should be at or near (500, 500)
    expect(Math.abs(result.buffer[0] - 500)).toBeLessThan(1)
    expect(Math.abs(result.buffer[1] - 500)).toBeLessThan(1)
  })

  it('drag-end releases a pinned node', () => {
    const engine = createPhysicsEngine()
    engine.init(makeNodes(3), [])
    engine.drag(0, 500, 500)
    engine.tick()
    engine.dragEnd(0)
    // After release, node should be free to move
    const result = engine.tick()
    expect(result.buffer).toBeInstanceOf(Float32Array)
  })

  it('reheat increases alpha', () => {
    const engine = createPhysicsEngine()
    engine.init(makeNodes(3), [])
    // Run until settled
    for (let i = 0; i < 500; i++) engine.tick()
    const before = engine.tick()
    expect(before.alpha).toBeLessThan(0.01)
    engine.reheat(0.5)
    const after = engine.tick()
    expect(after.alpha).toBeGreaterThan(before.alpha)
  })

  it('simulation converges with default params', () => {
    const engine = createPhysicsEngine()
    engine.init(makeNodes(10), [
      { source: 0, target: 1, kind: 'connection' as const },
      { source: 1, target: 2, kind: 'connection' as const },
      { source: 2, target: 3, kind: 'cluster' as const }
    ])
    let result = engine.tick()
    for (let i = 0; i < 600; i++) {
      result = engine.tick()
    }
    expect(result.settled).toBe(true)
    expect(result.alpha).toBeLessThan(0.002)
  })

  it('handles empty graph', () => {
    const engine = createPhysicsEngine()
    engine.init([], [])
    const result = engine.tick()
    expect(result.buffer.length).toBe(0)
    expect(result.settled).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/graph/graph-physics-worker.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the physics engine**

The file exports both a `createPhysicsEngine` function (for testing) and the Web Worker `onmessage` handler (for runtime). See the complete implementation below.

```typescript
// src/renderer/src/engine/graph-physics-worker.ts
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide
} from 'd3-force'
import type {
  SimNode,
  PhysicsCommand,
  PhysicsResult,
  ForceParams
} from '@renderer/panels/graph/graph-types'
import type { RelationshipKind } from '@shared/types'

interface D3Node {
  index: number
  x: number
  y: number
  vx: number
  vy: number
  fx: number | null
  fy: number | null
  id: string
}

interface D3Link {
  source: number | D3Node
  target: number | D3Node
  kind: RelationshipKind
}

const DEFAULTS: ForceParams = {
  centerStrength: 0.48,
  repelStrength: -250,
  linkStrength: 0.4,
  linkDistance: 180,
  velocityDecay: 0.4,
  alphaDecay: 0.02,
  alphaMin: 0.001
}

export function createPhysicsEngine(params: ForceParams = DEFAULTS) {
  let simulation: ReturnType<typeof forceSimulation<D3Node>> | null = null
  let d3Nodes: D3Node[] = []
  let positionBuffer = new Float32Array(0)

  function init(
    nodes: SimNode[],
    edges: ReadonlyArray<{ source: number; target: number; kind: RelationshipKind }>
  ) {
    // Spread nodes in a circle to avoid initial overlap
    const radius = Math.sqrt(nodes.length) * 30
    d3Nodes = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / (nodes.length || 1)
      return {
        index: i,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        id: n.id
      }
    })

    positionBuffer = new Float32Array(nodes.length * 2)

    const links: D3Link[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind
    }))

    simulation = forceSimulation<D3Node>(d3Nodes)
      .force(
        'charge',
        forceManyBody<D3Node>().strength(params.repelStrength).distanceMax(600)
      )
      .force(
        'link',
        forceLink<D3Node, D3Link>(links)
          .id((d) => d.index)
          .distance(params.linkDistance)
          .strength(params.linkStrength)
      )
      .force('center', forceCenter<D3Node>(0, 0).strength(params.centerStrength))
      .force('collide', forceCollide<D3Node>(12))
      .velocityDecay(params.velocityDecay)
      .alphaDecay(params.alphaDecay)
      .alphaMin(params.alphaMin)
      .stop() // We tick manually
  }

  function tick(): { buffer: Float32Array; alpha: number; settled: boolean } {
    if (!simulation || d3Nodes.length === 0) {
      return { buffer: new Float32Array(0), alpha: 0, settled: true }
    }

    simulation.tick()

    for (let i = 0; i < d3Nodes.length; i++) {
      positionBuffer[i * 2] = d3Nodes[i].x
      positionBuffer[i * 2 + 1] = d3Nodes[i].y
    }

    const alpha = simulation.alpha()
    const settled = alpha < (params.alphaMin + 0.001)

    return {
      buffer: new Float32Array(positionBuffer),
      alpha,
      settled
    }
  }

  function drag(nodeIndex: number, x: number, y: number) {
    if (!simulation || nodeIndex >= d3Nodes.length) return
    d3Nodes[nodeIndex].fx = x
    d3Nodes[nodeIndex].fy = y
    simulation.alphaTarget(0.3).restart()
    simulation.stop() // We still tick manually
  }

  function dragEnd(nodeIndex: number) {
    if (!simulation || nodeIndex >= d3Nodes.length) return
    d3Nodes[nodeIndex].fx = null
    d3Nodes[nodeIndex].fy = null
    simulation.alphaTarget(0)
  }

  function reheat(alpha = 0.5) {
    if (!simulation) return
    simulation.alpha(alpha)
  }

  function stop() {
    simulation?.stop()
  }

  function updateParams(newParams: Partial<ForceParams>) {
    if (!simulation) return
    const merged = { ...params, ...newParams }
    const charge = simulation.force('charge') as ReturnType<typeof forceManyBody>
    if (charge) charge.strength(merged.repelStrength)
    const link = simulation.force('link') as ReturnType<typeof forceLink>
    if (link) {
      link.distance(merged.linkDistance)
      link.strength(merged.linkStrength)
    }
    const center = simulation.force('center') as ReturnType<typeof forceCenter>
    if (center) center.strength(merged.centerStrength)
    simulation.velocityDecay(merged.velocityDecay)
    simulation.alphaDecay(merged.alphaDecay)
  }

  return { init, tick, drag, dragEnd, reheat, stop, updateParams }
}

// --- Web Worker entrypoint ---
// Only runs when loaded as a Worker (not when imported in tests)
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  const engine = createPhysicsEngine()
  let running = false
  let tickInterval: ReturnType<typeof setInterval> | null = null

  function startTicking() {
    if (tickInterval) return
    running = true
    tickInterval = setInterval(() => {
      if (!running) return
      const result = engine.tick()
      const msg: PhysicsResult = {
        type: 'positions',
        buffer: result.buffer,
        alpha: result.alpha,
        settled: result.settled
      }
      // Transfer the buffer for zero-copy
      self.postMessage(msg, [result.buffer.buffer])
      if (result.settled) {
        stopTicking()
      }
    }, 16) // ~60fps tick rate
  }

  function stopTicking() {
    running = false
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  self.onmessage = (e: MessageEvent<PhysicsCommand>) => {
    const cmd = e.data
    switch (cmd.type) {
      case 'init':
        engine.init(cmd.nodes, cmd.edges)
        self.postMessage({ type: 'ready' } satisfies PhysicsResult)
        startTicking()
        break
      case 'drag':
        engine.drag(cmd.nodeIndex, cmd.x, cmd.y)
        if (!running) startTicking()
        break
      case 'drag-end':
        engine.dragEnd(cmd.nodeIndex)
        break
      case 'reheat':
        engine.reheat(cmd.alpha)
        if (!running) startTicking()
        break
      case 'stop':
        stopTicking()
        engine.stop()
        break
      case 'resume':
        engine.reheat(0.3)
        startTicking()
        break
      case 'update-params':
        engine.updateParams(cmd.params)
        break
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/graph/graph-physics-worker.test.ts
```

Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/engine/graph-physics-worker.ts tests/graph/graph-physics-worker.test.ts
git commit -m "feat(graph): add physics engine with d3-force simulation and worker entrypoint"
```

---

## Task 4: Theme Bridge

**Files:**
- Create: `src/renderer/src/panels/graph/graph-theme-bridge.ts`
- Create: `tests/graph/graph-theme-bridge.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/graph/graph-theme-bridge.test.ts
import { describe, it, expect } from 'vitest'
import { hexToPixi, cssColorToPixi, buildEdgeColor } from '@renderer/panels/graph/graph-theme-bridge'

describe('graph-theme-bridge', () => {
  describe('hexToPixi', () => {
    it('converts #ffffff to 0xffffff', () => {
      expect(hexToPixi('#ffffff')).toBe(0xffffff)
    })

    it('converts #000000 to 0x000000', () => {
      expect(hexToPixi('#000000')).toBe(0x000000)
    })

    it('converts #22d3ee to correct value', () => {
      expect(hexToPixi('#22d3ee')).toBe(0x22d3ee)
    })

    it('handles 3-digit hex', () => {
      expect(hexToPixi('#fff')).toBe(0xffffff)
    })
  })

  describe('cssColorToPixi', () => {
    it('converts rgb(255, 0, 0) to 0xff0000', () => {
      expect(cssColorToPixi('rgb(255, 0, 0)')).toBe(0xff0000)
    })

    it('converts hex string', () => {
      expect(cssColorToPixi('#34D399')).toBe(0x34d399)
    })
  })

  describe('buildEdgeColor', () => {
    it('returns cluster color for cluster kind', () => {
      const c = buildEdgeColor('cluster')
      expect(typeof c).toBe('number')
    })

    it('returns tension color for tension kind', () => {
      const c = buildEdgeColor('tension')
      expect(typeof c).toBe('number')
    })

    it('returns default color for connection kind', () => {
      const c = buildEdgeColor('connection')
      expect(typeof c).toBe('number')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/graph/graph-theme-bridge.test.ts
```

- [ ] **Step 3: Implement theme bridge**

```typescript
// src/renderer/src/panels/graph/graph-theme-bridge.ts
import { ARTIFACT_COLORS, getArtifactColor } from '@renderer/design/tokens'
import type { ArtifactType, RelationshipKind } from '@shared/types'
import type { GraphThemeColors } from './graph-types'

/** Convert a hex color string to a PixiJS-compatible integer. */
export function hexToPixi(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  return parseInt(h, 16)
}

/** Convert CSS color string (hex or rgb()) to PixiJS integer. */
export function cssColorToPixi(css: string): number {
  if (css.startsWith('#')) return hexToPixi(css)
  const match = css.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (match) {
    return (parseInt(match[1]) << 16) | (parseInt(match[2]) << 8) | parseInt(match[3])
  }
  return 0x94a3b8 // fallback: slate
}

/** Get the PixiJS tint color for an artifact type. */
export function nodeColorForType(type: ArtifactType): number {
  return hexToPixi(getArtifactColor(type))
}

// Semantic relationship colors (from tokens.ts)
const CLUSTER_COLOR = 0x34d399 // semantic.cluster
const TENSION_COLOR = 0xf59e0b // semantic.tension
const DEFAULT_EDGE_COLOR = 0x475569 // slate-600
const COOCCURRENCE_COLOR = 0x334155 // slate-700
const APPEARS_IN_COLOR = 0x64748b // slate-500

/** Get the PixiJS color for an edge based on its relationship kind. */
export function buildEdgeColor(kind: RelationshipKind): number {
  switch (kind) {
    case 'cluster':
      return CLUSTER_COLOR
    case 'tension':
      return TENSION_COLOR
    case 'connection':
      return DEFAULT_EDGE_COLOR
    case 'appears_in':
      return APPEARS_IN_COLOR
    case 'co-occurrence':
      return COOCCURRENCE_COLOR
  }
}

/** Edge opacity by kind (explicit relationships more visible than inferred). */
export function edgeOpacity(kind: RelationshipKind): number {
  switch (kind) {
    case 'connection':
    case 'cluster':
    case 'tension':
      return 0.6
    case 'appears_in':
      return 0.4
    case 'co-occurrence':
      return 0.2
  }
}

/**
 * Read resolved CSS colors from the DOM via the Obsidian bridge pattern.
 * Creates invisible elements with CSS classes, reads getComputedStyle, removes them.
 * Call once on mount and on theme change.
 */
export function readThemeColors(): GraphThemeColors {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const bg = style.getPropertyValue('--color-bg-base').trim()
  const text = style.getPropertyValue('--color-text-primary').trim()
  const textDim = style.getPropertyValue('--color-text-muted').trim()
  const accent = style.getPropertyValue('--color-accent-default').trim()

  return {
    background: bg ? cssColorToPixi(bg) : 0x141414,
    nodeFill: 0x94a3b8,
    nodeFillFocused: accent ? cssColorToPixi(accent) : 0x00e5bf,
    nodeFillGhost: 0x334155,
    nodeStroke: 0x475569,
    edge: DEFAULT_EDGE_COLOR,
    edgeHighlight: accent ? cssColorToPixi(accent) : 0x00e5bf,
    labelText: text ? cssColorToPixi(text) : 0xe2e8f0,
    labelTextDim: textDim ? cssColorToPixi(textDim) : 0x64748b
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/graph/graph-theme-bridge.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/panels/graph/graph-theme-bridge.ts tests/graph/graph-theme-bridge.test.ts
git commit -m "feat(graph): add CSS-to-PixiJS theme bridge with Obsidian color pattern"
```

---

## Task 5: LOD System

**Files:**
- Create: `src/renderer/src/panels/graph/graph-lod.ts`
- Create: `tests/graph/graph-lod.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/graph/graph-lod.test.ts
import { describe, it, expect } from 'vitest'
import {
  getGraphLod,
  shouldShowLabel,
  nodeRadius,
  edgeWidth
} from '@renderer/panels/graph/graph-lod'

describe('graph-lod', () => {
  it('returns macro for very low zoom', () => {
    expect(getGraphLod(0.1)).toBe('macro')
    expect(getGraphLod(0.2)).toBe('macro')
  })

  it('returns meso for medium zoom', () => {
    expect(getGraphLod(0.5)).toBe('meso')
    expect(getGraphLod(0.8)).toBe('meso')
  })

  it('returns micro for high zoom', () => {
    expect(getGraphLod(1.5)).toBe('micro')
    expect(getGraphLod(3.0)).toBe('micro')
  })

  it('never shows labels at macro', () => {
    expect(shouldShowLabel('macro', 10)).toBe(false)
    expect(shouldShowLabel('macro', 100)).toBe(false)
  })

  it('shows labels for high-connection nodes at meso', () => {
    expect(shouldShowLabel('meso', 8)).toBe(true)
    expect(shouldShowLabel('meso', 1)).toBe(false)
  })

  it('shows all labels at micro', () => {
    expect(shouldShowLabel('micro', 0)).toBe(true)
    expect(shouldShowLabel('micro', 1)).toBe(true)
  })

  it('scales node radius by connection count', () => {
    const small = nodeRadius(0)
    const large = nodeRadius(20)
    expect(large).toBeGreaterThan(small)
    expect(small).toBeGreaterThanOrEqual(4)
    expect(large).toBeLessThanOrEqual(24)
  })

  it('scales edge width by zoom', () => {
    const thin = edgeWidth(0.3)
    const thick = edgeWidth(2.0)
    expect(thick).toBeGreaterThanOrEqual(thin)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/graph/graph-lod.test.ts
```

- [ ] **Step 3: Implement LOD system**

```typescript
// src/renderer/src/panels/graph/graph-lod.ts
import type { LodLevel } from './graph-types'

const MACRO_THRESHOLD = 0.35
const MICRO_THRESHOLD = 1.2
const MESO_LABEL_MIN_CONNECTIONS = 5

/** Determine LOD tier from current zoom scale. */
export function getGraphLod(scale: number): LodLevel {
  if (scale < MACRO_THRESHOLD) return 'macro'
  if (scale >= MICRO_THRESHOLD) return 'micro'
  return 'meso'
}

/** Whether to show a label for this node at the current LOD. */
export function shouldShowLabel(lod: LodLevel, connectionCount: number): boolean {
  if (lod === 'macro') return false
  if (lod === 'micro') return true
  return connectionCount >= MESO_LABEL_MIN_CONNECTIONS
}

/** Base node radius scaled by connection count. Min 4, max 24. */
export function nodeRadius(connectionCount: number): number {
  const base = 5
  const scaled = base + Math.sqrt(connectionCount) * 2.5
  return Math.min(Math.max(scaled, 4), 24)
}

/** Edge line width scaled by zoom (thinner when zoomed out). */
export function edgeWidth(scale: number): number {
  const base = 1.2
  return Math.max(0.5, base / Math.sqrt(Math.max(scale, 0.1)))
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/graph/graph-lod.test.ts
```

Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/panels/graph/graph-lod.ts tests/graph/graph-lod.test.ts
git commit -m "feat(graph): add LOD system with zoom-based detail tiers"
```

---

## Task 6: Graph Renderer (PixiJS Core)

**Files:**
- Create: `src/renderer/src/panels/graph/graph-renderer.ts`
- Create: `tests/graph/graph-renderer.test.ts`

This is the largest task. The renderer owns the PixiJS Application, the render loop, and the visual representation of nodes and edges.

- [ ] **Step 1: Write failing tests for renderer lifecycle**

```typescript
// tests/graph/graph-renderer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GraphRenderer } from '@renderer/panels/graph/graph-renderer'

// PixiJS requires WebGL context. In vitest (Node.js), we test the
// public API contract without actually rendering.
// The renderer is designed to be testable via its public interface.

describe('GraphRenderer', () => {
  it('can be constructed with a config', () => {
    const renderer = new GraphRenderer({
      onNodeHover: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragEnd: vi.fn(),
      onViewportChange: vi.fn()
    })
    expect(renderer).toBeDefined()
  })

  it('setPositions stores position data for next render', () => {
    const renderer = new GraphRenderer({
      onNodeHover: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragEnd: vi.fn(),
      onViewportChange: vi.fn()
    })
    const positions = new Float32Array([10, 20, 30, 40])
    renderer.setPositions(positions)
    expect(renderer.getNodeCount()).toBe(0) // No nodes loaded yet
  })

  it('tracks paused state', () => {
    const renderer = new GraphRenderer({
      onNodeHover: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragEnd: vi.fn(),
      onViewportChange: vi.fn()
    })
    expect(renderer.isPaused()).toBe(true) // Not started
    renderer.pause()
    expect(renderer.isPaused()).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/graph/graph-renderer.test.ts
```

- [ ] **Step 3: Implement graph-renderer.ts**

This is the PixiJS rendering engine. Key design decisions:
- Nodes are PIXI.Graphics circles (efficient batching)
- Edges are PIXI.Graphics lines drawn each frame
- Labels are on a separate Canvas 2D overlay (not PixiJS)
- The render loop reads positions from the latest Float32Array posted by the worker
- Hover detection uses d3-quadtree rebuilt each frame
- Viewport transform is applied via PIXI.Container position/scale

```typescript
// src/renderer/src/panels/graph/graph-renderer.ts
import { Application, Container, Graphics } from 'pixi.js'
import { quadtree as d3Quadtree } from 'd3-quadtree'
import type { SimNode, LodLevel, GraphViewport } from './graph-types'
import type { RelationshipKind } from '@shared/types'
import { nodeColorForType, buildEdgeColor, edgeOpacity } from './graph-theme-bridge'
import { getGraphLod, nodeRadius, edgeWidth } from './graph-lod'
import { SIGNAL_OPACITY } from '@shared/types'

interface RendererCallbacks {
  onNodeHover: (nodeIndex: number | null) => void
  onNodeClick: (nodeIndex: number) => void
  onNodeDrag: (nodeIndex: number, x: number, y: number) => void
  onNodeDragEnd: (nodeIndex: number) => void
  onViewportChange: (viewport: GraphViewport) => void
}

interface EdgeData {
  sourceIndex: number
  targetIndex: number
  kind: RelationshipKind
}

export class GraphRenderer {
  private app: Application | null = null
  private worldContainer: Container | null = null
  private nodeContainer: Container | null = null
  private edgeGraphics: Graphics | null = null

  private nodes: SimNode[] = []
  private edges: EdgeData[] = []
  private positions: Float32Array = new Float32Array(0)
  private nodeGraphics: Graphics[] = []

  private viewport: GraphViewport = { x: 0, y: 0, scale: 1 }
  private paused = true
  private mounted = false
  private animFrameId: number | null = null

  private callbacks: RendererCallbacks

  // Interaction state
  private hoveredIndex: number | null = null
  private draggedIndex: number | null = null
  private dragStartPos = { x: 0, y: 0 }
  private isPanning = false
  private panStart = { x: 0, y: 0 }
  private panViewportStart = { x: 0, y: 0 }

  constructor(callbacks: RendererCallbacks) {
    this.callbacks = callbacks
  }

  /** Mount the renderer into a DOM element. Call once. */
  async mount(container: HTMLElement): Promise<void> {
    if (this.mounted) return

    this.app = new Application()
    await this.app.init({
      resizeTo: container,
      backgroundColor: 0x141414,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    })

    container.appendChild(this.app.canvas as HTMLCanvasElement)

    this.worldContainer = new Container()
    this.app.stage.addChild(this.worldContainer)

    this.edgeGraphics = new Graphics()
    this.worldContainer.addChild(this.edgeGraphics)

    this.nodeContainer = new Container()
    this.worldContainer.addChild(this.nodeContainer)

    this.mounted = true
    this.paused = false

    // Bind interaction events to the canvas
    const canvas = this.app.canvas as HTMLCanvasElement
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointerleave', this.handlePointerUp)

    this.startRenderLoop()
  }

  /** Unmount and clean up all resources. */
  destroy(): void {
    this.mounted = false
    this.paused = true

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    if (this.app) {
      const canvas = this.app.canvas as HTMLCanvasElement
      canvas.removeEventListener('wheel', this.handleWheel)
      canvas.removeEventListener('pointerdown', this.handlePointerDown)
      canvas.removeEventListener('pointermove', this.handlePointerMove)
      canvas.removeEventListener('pointerup', this.handlePointerUp)
      canvas.removeEventListener('pointerleave', this.handlePointerUp)

      this.app.destroy(true, { children: true, texture: true })
      this.app = null
    }

    this.worldContainer = null
    this.nodeContainer = null
    this.edgeGraphics = null
    this.nodeGraphics = []
  }

  /** Load graph data. Call when vault-store.graph changes. */
  setGraphData(nodes: SimNode[], edges: EdgeData[]): void {
    this.nodes = nodes
    this.edges = edges
    this.rebuildNodeGraphics()
  }

  /** Receive new positions from the physics worker. */
  setPositions(buffer: Float32Array): void {
    this.positions = buffer
  }

  getNodeCount(): number {
    return this.nodes.length
  }

  isPaused(): boolean {
    return this.paused
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
    if (this.mounted && this.animFrameId === null) {
      this.startRenderLoop()
    }
  }

  /** Highlight a node and its neighborhood. */
  setHighlightedNode(nodeIndex: number | null): void {
    this.hoveredIndex = nodeIndex
  }

  // ---- Private: Render Loop ----

  private startRenderLoop(): void {
    const loop = () => {
      if (!this.mounted || this.paused) {
        this.animFrameId = null
        return
      }
      this.render()
      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  private render(): void {
    if (!this.worldContainer || !this.app || this.positions.length === 0) return

    const { x, y, scale } = this.viewport
    const width = this.app.screen.width
    const height = this.app.screen.height

    // Apply viewport transform: center of screen + pan offset, then scale
    this.worldContainer.position.set(width / 2 + x, height / 2 + y)
    this.worldContainer.scale.set(scale)

    const lod = getGraphLod(scale)

    this.renderEdges(lod)
    this.renderNodes(lod)
  }

  private renderNodes(lod: LodLevel): void {
    if (!this.nodeContainer) return

    const neighborSet = this.hoveredIndex !== null ? this.getNeighborSet(this.hoveredIndex) : null

    for (let i = 0; i < this.nodes.length; i++) {
      const g = this.nodeGraphics[i]
      if (!g) continue

      const px = this.positions[i * 2]
      const py = this.positions[i * 2 + 1]
      if (px === undefined || py === undefined) continue

      g.position.set(px, py)

      // Opacity: signal-based, dimmed when hovering another node
      let alpha = SIGNAL_OPACITY[this.nodes[i].signal]
      if (this.nodes[i].isGhost) alpha = 0.35
      if (neighborSet && !neighborSet.has(i)) alpha *= 0.15

      g.alpha = alpha
    }
  }

  private renderEdges(lod: LodLevel): void {
    if (!this.edgeGraphics) return
    this.edgeGraphics.clear()

    if (lod === 'macro') return // Skip edges at macro zoom

    const neighborSet = this.hoveredIndex !== null ? this.getNeighborSet(this.hoveredIndex) : null
    const width = edgeWidth(this.viewport.scale)

    for (const edge of this.edges) {
      const sx = this.positions[edge.sourceIndex * 2]
      const sy = this.positions[edge.sourceIndex * 2 + 1]
      const tx = this.positions[edge.targetIndex * 2]
      const ty = this.positions[edge.targetIndex * 2 + 1]
      if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) continue

      let alpha = edgeOpacity(edge.kind)
      if (neighborSet) {
        const isNeighborEdge =
          (edge.sourceIndex === this.hoveredIndex || edge.targetIndex === this.hoveredIndex) &&
          neighborSet.has(edge.sourceIndex) &&
          neighborSet.has(edge.targetIndex)
        alpha = isNeighborEdge ? 0.8 : 0.05
      }

      const color = buildEdgeColor(edge.kind)
      this.edgeGraphics.moveTo(sx, sy)
      this.edgeGraphics.lineTo(tx, ty)
      this.edgeGraphics.stroke({ width, color, alpha })
    }
  }

  private rebuildNodeGraphics(): void {
    if (!this.nodeContainer) return

    // Clear existing
    this.nodeContainer.removeChildren()
    this.nodeGraphics = []

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i]
      const radius = nodeRadius(node.connectionCount)
      const color = nodeColorForType(node.type)

      const g = new Graphics()
      g.circle(0, 0, radius)
      g.fill({ color })
      g.circle(0, 0, radius)
      g.stroke({ width: 1, color: 0x475569, alpha: 0.4 })

      g.eventMode = 'static'
      g.cursor = 'pointer'
      g.hitArea = { contains: (x: number, y: number) => x * x + y * y <= (radius + 4) ** 2 }

      this.nodeContainer.addChild(g)
      this.nodeGraphics.push(g)
    }
  }

  /** Get the set of node indices that are neighbors of the given node (including itself). */
  private getNeighborSet(nodeIndex: number): Set<number> {
    const neighbors = new Set<number>([nodeIndex])
    for (const edge of this.edges) {
      if (edge.sourceIndex === nodeIndex) neighbors.add(edge.targetIndex)
      if (edge.targetIndex === nodeIndex) neighbors.add(edge.sourceIndex)
    }
    return neighbors
  }

  // ---- Private: Quadtree for hover detection ----

  private findNodeAtPosition(screenX: number, screenY: number): number | null {
    if (!this.app || this.positions.length === 0) return null

    const width = this.app.screen.width
    const height = this.app.screen.height
    const { x, y, scale } = this.viewport

    // Convert screen coords to world coords
    const worldX = (screenX - width / 2 - x) / scale
    const worldY = (screenY - height / 2 - y) / scale

    // Build quadtree for efficient nearest-neighbor search
    const tree = d3Quadtree<number>()
      .x((i) => this.positions[i * 2])
      .y((i) => this.positions[i * 2 + 1])
      .addAll(Array.from({ length: this.nodes.length }, (_, i) => i))

    const hitRadius = 20 / scale // Scale hit area with zoom
    const found = tree.find(worldX, worldY, hitRadius)
    return found ?? null
  }

  // ---- Private: Interaction Handlers ----

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (!this.app) return

    const width = this.app.screen.width
    const height = this.app.screen.height

    // Zoom toward cursor
    const rect = (this.app.canvas as HTMLCanvasElement).getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08
    const newScale = Math.min(Math.max(this.viewport.scale * zoomFactor, 0.05), 5)
    const ratio = newScale / this.viewport.scale

    // Adjust pan to zoom toward cursor
    const cx = width / 2
    const cy = height / 2
    const newX = mx - ratio * (mx - cx - this.viewport.x) - cx
    const newY = my - ratio * (my - cy - this.viewport.y) - cy

    this.viewport = { x: newX, y: newY, scale: newScale }
    this.callbacks.onViewportChange(this.viewport)
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.app) return

    const rect = (this.app.canvas as HTMLCanvasElement).getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const nodeIdx = this.findNodeAtPosition(sx, sy)

    if (nodeIdx !== null && e.button === 0) {
      // Start node drag
      this.draggedIndex = nodeIdx
      this.dragStartPos = { x: sx, y: sy }
    } else {
      // Start pan
      this.isPanning = true
      this.panStart = { x: e.clientX, y: e.clientY }
      this.panViewportStart = { x: this.viewport.x, y: this.viewport.y }
    }
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.app) return

    const rect = (this.app.canvas as HTMLCanvasElement).getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    if (this.draggedIndex !== null) {
      // Node dragging — convert screen to world coords
      const width = this.app.screen.width
      const height = this.app.screen.height
      const worldX = (sx - width / 2 - this.viewport.x) / this.viewport.scale
      const worldY = (sy - height / 2 - this.viewport.y) / this.viewport.scale
      this.callbacks.onNodeDrag(this.draggedIndex, worldX, worldY)
    } else if (this.isPanning) {
      // Viewport panning
      const dx = e.clientX - this.panStart.x
      const dy = e.clientY - this.panStart.y
      this.viewport = {
        ...this.viewport,
        x: this.panViewportStart.x + dx,
        y: this.panViewportStart.y + dy
      }
      this.callbacks.onViewportChange(this.viewport)
    } else {
      // Hover detection
      const nodeIdx = this.findNodeAtPosition(sx, sy)
      if (nodeIdx !== this.hoveredIndex) {
        this.hoveredIndex = nodeIdx
        this.callbacks.onNodeHover(nodeIdx)
      }
    }
  }

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.app) return

    if (this.draggedIndex !== null) {
      const rect = (this.app.canvas as HTMLCanvasElement).getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const moved = Math.hypot(sx - this.dragStartPos.x, sy - this.dragStartPos.y)

      if (moved < 5) {
        // Click, not drag
        this.callbacks.onNodeClick(this.draggedIndex)
      } else {
        this.callbacks.onNodeDragEnd(this.draggedIndex)
      }
      this.draggedIndex = null
    }

    this.isPanning = false
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/graph/graph-renderer.test.ts
```

Expected: All 3 tests PASS (lifecycle tests, no WebGL required)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/panels/graph/graph-renderer.ts tests/graph/graph-renderer.test.ts
git commit -m "feat(graph): add PixiJS WebGL renderer with node/edge rendering and interactions"
```

---

## Task 7: Label Layer (Canvas 2D Overlay)

**Files:**
- Create: `src/renderer/src/panels/graph/graph-label-layer.ts`

- [ ] **Step 1: Implement the Canvas 2D label overlay**

This renders text labels on a Canvas 2D element layered on top of the PixiJS WebGL canvas. This gives native text quality (anti-aliased, crisp at all DPIs) without the complexity of SDF text in WebGL.

```typescript
// src/renderer/src/panels/graph/graph-label-layer.ts
import type { SimNode, GraphViewport, LodLevel } from './graph-types'
import { shouldShowLabel } from './graph-lod'
import { SIGNAL_OPACITY } from '@shared/types'

export class LabelLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private dpr: number

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'absolute'
    this.canvas.style.inset = '0'
    this.canvas.style.pointerEvents = 'none'
    this.ctx = this.canvas.getContext('2d')!
    this.dpr = window.devicePixelRatio || 1
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.canvas)
    this.resize(container.clientWidth, container.clientHeight)
  }

  destroy(): void {
    this.canvas.remove()
  }

  resize(width: number, height: number): void {
    this.dpr = window.devicePixelRatio || 1
    this.canvas.width = width * this.dpr
    this.canvas.height = height * this.dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
  }

  render(
    nodes: SimNode[],
    positions: Float32Array,
    viewport: GraphViewport,
    lod: LodLevel,
    hoveredIndex: number | null,
    neighborSet: Set<number> | null
  ): void {
    const { ctx, dpr } = this
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)

    if (lod === 'macro') return // No labels at macro zoom

    ctx.save()
    ctx.scale(dpr, dpr)

    const cw = w / dpr
    const ch = h / dpr

    // Font scales with zoom but has floor and ceiling
    const fontSize = Math.min(Math.max(11 / viewport.scale, 8), 14)
    ctx.font = `500 ${fontSize}px "DM Sans", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    for (let i = 0; i < nodes.length; i++) {
      if (!shouldShowLabel(lod, nodes[i].connectionCount)) continue

      const wx = positions[i * 2]
      const wy = positions[i * 2 + 1]
      if (wx === undefined || wy === undefined) continue

      // World → screen
      const sx = cw / 2 + viewport.x + wx * viewport.scale
      const sy = ch / 2 + viewport.y + wy * viewport.scale

      // Cull offscreen labels (with padding)
      if (sx < -100 || sx > cw + 100 || sy < -50 || sy > ch + 50) continue

      let alpha = SIGNAL_OPACITY[nodes[i].signal]
      if (nodes[i].isGhost) alpha = 0.3

      // Dim non-neighbors when hovering
      if (neighborSet && !neighborSet.has(i)) alpha *= 0.1

      // Force show label for hovered node
      if (i === hoveredIndex) alpha = 1.0

      const yOffset = 8 + Math.sqrt(nodes[i].connectionCount) * 2.5 // Below node

      ctx.globalAlpha = alpha
      // Text stroke for readability
      ctx.strokeStyle = 'rgba(20, 20, 20, 0.8)'
      ctx.lineWidth = 3
      ctx.strokeText(nodes[i].id, sx, sy + yOffset)
      // Text fill
      ctx.fillStyle = '#e2e8f0'
      ctx.fillText(nodes[i].id, sx, sy + yOffset)
    }

    ctx.restore()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/panels/graph/graph-label-layer.ts
git commit -m "feat(graph): add Canvas 2D label overlay for native text quality"
```

---

## Task 8: GraphPanel React Shell + App Integration

**Files:**
- Create: `src/renderer/src/panels/graph/GraphPanel.tsx`
- Modify: `src/renderer/src/App.tsx`

This is where everything connects: vault-store graph data flows to the physics worker, positions flow to the renderer, interactions flow back to the store.

- [ ] **Step 1: Implement GraphPanel.tsx**

```typescript
// src/renderer/src/panels/graph/GraphPanel.tsx
import { useEffect, useRef, useCallback } from 'react'
import { useVaultStore } from '@renderer/store/vault-store'
import { useEditorStore } from '@renderer/store/editor-store'
import { useGraphViewStore } from '@renderer/store/graph-view-store'
import { GraphRenderer } from './graph-renderer'
import { LabelLayer } from './graph-label-layer'
import { getGraphLod } from './graph-lod'
import type { SimNode, PhysicsCommand, PhysicsResult } from './graph-types'
import type { GraphEdge, KnowledgeGraph } from '@shared/types'

/** Convert KnowledgeGraph data into worker-compatible format. */
function prepareSimData(graph: KnowledgeGraph) {
  const nodeIndexMap = new Map<string, number>()
  const simNodes: SimNode[] = graph.nodes.map((n, i) => {
    nodeIndexMap.set(n.id, i)
    return {
      index: i,
      id: n.id,
      type: n.type,
      signal: n.signal,
      connectionCount: n.connectionCount,
      isGhost: !n.path // Ghost nodes have no file path
    }
  })

  const simEdges = graph.edges
    .map((e) => {
      const si = nodeIndexMap.get(e.source)
      const ti = nodeIndexMap.get(e.target)
      if (si === undefined || ti === undefined) return null
      return { source: si, target: ti, kind: e.kind }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  return { simNodes, simEdges, nodeIndexMap }
}

export function GraphPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<GraphRenderer | null>(null)
  const labelLayerRef = useRef<LabelLayer | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const positionsRef = useRef<Float32Array>(new Float32Array(0))
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map())
  const edgesRef = useRef<Array<{ source: number; target: number }>>([])
  const mountedRef = useRef(false)

  const graph = useVaultStore((s) => s.graph)
  const fileToId = useVaultStore((s) => s.fileToId)
  const artifacts = useVaultStore((s) => s.artifacts)

  const setHoveredNode = useGraphViewStore((s) => s.setHoveredNode)
  const setSelectedNode = useGraphViewStore((s) => s.setSelectedNode)
  const setSimulationState = useGraphViewStore((s) => s.setSimulationState)
  const setViewport = useGraphViewStore((s) => s.setViewport)
  const setGraphStats = useGraphViewStore((s) => s.setGraphStats)

  // ---- Initialize renderer + worker on mount ----
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    mountedRef.current = true

    const renderer = new GraphRenderer({
      onNodeHover: (idx) => {
        if (!mountedRef.current) return
        const id = idx !== null ? simNodesRef.current[idx]?.id ?? null : null
        setHoveredNode(id)
        renderer.setHighlightedNode(idx)
      },
      onNodeClick: (idx) => {
        if (!mountedRef.current) return
        const node = simNodesRef.current[idx]
        if (!node) return

        setSelectedNode(node.id)

        // Navigate to the note in the editor
        const artifact = artifacts.find((a) => a.id === node.id)
        if (artifact) {
          const path = Object.entries(fileToId).find(([, id]) => id === node.id)?.[0]
          if (path) {
            useEditorStore.getState().setActiveNote(node.id, path)
          }
        }
      },
      onNodeDrag: (idx, x, y) => {
        if (!workerRef.current) return
        const cmd: PhysicsCommand = { type: 'drag', nodeIndex: idx, x, y }
        workerRef.current.postMessage(cmd)
      },
      onNodeDragEnd: (idx) => {
        if (!workerRef.current) return
        const cmd: PhysicsCommand = { type: 'drag-end', nodeIndex: idx }
        workerRef.current.postMessage(cmd)
      },
      onViewportChange: (vp) => {
        if (!mountedRef.current) return
        setViewport(vp)
      }
    })

    renderer.mount(container)
    rendererRef.current = renderer

    const labelLayer = new LabelLayer()
    labelLayer.mount(container)
    labelLayerRef.current = labelLayer

    // Spawn physics worker
    const worker = new Worker(
      new URL('@engine/graph-physics-worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e: MessageEvent<PhysicsResult>) => {
      if (!mountedRef.current) return
      const msg = e.data

      if (msg.type === 'positions') {
        positionsRef.current = msg.buffer
        renderer.setPositions(msg.buffer)
        setSimulationState(msg.alpha, msg.settled)

        // Update label layer
        const vp = useGraphViewStore.getState().viewport
        const lod = getGraphLod(vp.scale)
        const hoveredId = useGraphViewStore.getState().hoveredNodeId
        const hoveredIdx = hoveredId ? nodeIndexMapRef.current.get(hoveredId) ?? null : null
        const neighborSet = hoveredIdx !== null ? getNeighborSet(hoveredIdx) : null

        labelLayer.render(simNodesRef.current, msg.buffer, vp, lod, hoveredIdx, neighborSet)
      }
    }

    workerRef.current = worker

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        labelLayer.resize(width, height)
      }
    })
    resizeObserver.observe(container)

    return () => {
      mountedRef.current = false
      resizeObserver.disconnect()
      renderer.destroy()
      labelLayer.destroy()
      worker.terminate()
      rendererRef.current = null
      labelLayerRef.current = null
      workerRef.current = null
      useGraphViewStore.getState().reset()
    }
  }, []) // Mount once

  // Helper for neighbor highlighting (uses cached edges, not recomputed)
  function getNeighborSet(nodeIndex: number): Set<number> {
    const neighbors = new Set<number>([nodeIndex])
    for (const edge of edgesRef.current) {
      if (edge.source === nodeIndex) neighbors.add(edge.target)
      if (edge.target === nodeIndex) neighbors.add(edge.source)
    }
    return neighbors
  }

  // ---- Send graph data to worker when it changes ----
  useEffect(() => {
    if (!workerRef.current || graph.nodes.length === 0) return

    const { simNodes, simEdges, nodeIndexMap } = prepareSimData(graph)
    simNodesRef.current = simNodes
    nodeIndexMapRef.current = nodeIndexMap
    edgesRef.current = simEdges

    const renderer = rendererRef.current
    if (renderer) {
      renderer.setGraphData(
        simNodes,
        simEdges.map((e) => ({
          sourceIndex: e.source,
          targetIndex: e.target,
          kind: e.kind
        }))
      )
    }

    setGraphStats(simNodes.length, simEdges.length)

    const cmd: PhysicsCommand = { type: 'init', nodes: simNodes, edges: simEdges }
    workerRef.current.postMessage(cmd)
  }, [graph])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    />
  )
}
```

- [ ] **Step 2: Add GraphPanel to App.tsx ContentArea**

In `src/renderer/src/App.tsx`, add the import and conditional render:

```typescript
// Add import at top:
import { GraphPanel } from './panels/graph/GraphPanel'

// In ContentArea(), add after the project-canvas line:
{contentView === 'graph' && <GraphPanel />}
```

- [ ] **Step 3: Add Cmd+Shift+G keyboard shortcut to App.tsx**

In the existing keyboard handler in App.tsx, add:

```typescript
// Cmd+Shift+G → toggle graph view
if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'g') {
  e.preventDefault()
  useViewStore.getState().toggleGraph()
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/panels/graph/GraphPanel.tsx src/renderer/src/App.tsx
git commit -m "feat(graph): add GraphPanel shell with worker bridge and Cmd+Shift+G shortcut"
```

---

## Task 9: Visual Verification + Polish

**Files:**
- Modify: `src/renderer/src/panels/graph/graph-renderer.ts` (if needed)
- Modify: `src/renderer/src/panels/graph/graph-label-layer.ts` (if needed)

This task is the visual gate. Run the app and verify the graph renders correctly.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/caseytalbot/Projects/thought-engine
npm run dev
```

- [ ] **Step 2: Open a vault and switch to graph view**

Press Cmd+Shift+G. The graph should:
1. Show nodes as colored circles (type-encoded colors from ARTIFACT_COLORS)
2. Show edges between connected nodes
3. Physics should animate nodes spreading out and settling
4. Zoom with scroll wheel (centered on cursor)
5. Pan by dragging empty space
6. Hover a node to highlight its neighborhood (everything else dims)
7. Click a node to navigate to that note in the editor
8. Labels appear for high-connection nodes

- [ ] **Step 3: Take a screenshot and share it with the user**

Ask the user to share a screenshot of the graph view for visual verification. Do NOT take screenshots programmatically.

- [ ] **Step 4: Fix any visual issues found**

Common issues to check:
- Node colors match ARTIFACT_COLORS
- Ghost nodes render with lower opacity
- Edge colors match relationship kinds (green for cluster, amber for tension)
- Labels are readable against dark background
- Zoom feels smooth (no jank)
- Physics settles naturally (not bouncy, not stiff)
- Hover highlight transitions are instant
- Click navigates correctly

- [ ] **Step 5: Commit fixes**

```bash
git add src/renderer/src/panels/graph/graph-renderer.ts src/renderer/src/panels/graph/graph-label-layer.ts
git commit -m "fix(graph): visual polish from verification pass"
```

---

## Task 10: Live Updates + Graph Data Bridge

**Files:**
- Modify: `src/renderer/src/panels/graph/GraphPanel.tsx`

- [ ] **Step 1: Verify live updates work**

The GraphPanel already watches `graph` from vault-store via the `useEffect` dependency. When files change:
1. vault-worker re-parses the modified file
2. vault-store.graph updates
3. GraphPanel's useEffect fires
4. New graph data is sent to the physics worker via `init` command
5. Worker reheats simulation, positions flow back

Test this by:
- Opening a note in the editor (split view if possible)
- Adding a `connections:` entry to a note's frontmatter
- Saving the file
- Verifying the graph updates with the new edge

- [ ] **Step 2: Verify graph → editor navigation**

Click a node in the graph. The editor should:
1. Open the corresponding note
2. The sidebar should show the file as active

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/panels/graph/
git commit -m "feat(graph): verify live updates and graph-editor navigation"
```

---

## Deconfliction Assurance

This plan is fully deconflicted with the parallel canvas work:

| Concern | Resolution |
|---------|-----------|
| **canvas-store.ts** | Untouched. Graph has its own store (graph-view-store.ts) |
| **CanvasView/CanvasSurface** | Untouched. Graph uses PixiJS directly, not the canvas infrastructure |
| **Store-swap pattern** | Not used. Graph panel has no state to swap (it reads vault-store.graph directly) |
| **EdgeLayer.tsx** | Untouched. Graph renders edges via PixiJS Graphics, not SVG |
| **ClaudeConfigPanel/ProjectCanvasPanel** | Untouched. Graph is a peer ContentView, not a canvas variant |
| **view-store.ts** | Minimal change: add 'graph' to the ContentView union + toggleGraph method |
| **App.tsx** | Minimal change: add `{contentView === 'graph' && <GraphPanel />}` + Cmd+Shift+G shortcut |
| **vault-store.ts** | Read-only. Graph reads `graph` field, does not modify it |
| **graph-builder.ts** | Untouched. The physics worker receives pre-built KnowledgeGraph data |
| **vault-worker.ts** | Untouched. It produces graph data as it always has |
| **tokens.ts** | Read-only. Theme bridge reads ARTIFACT_COLORS and semantic colors |

**Zero shared mutable state. Zero file conflicts. The graph panel is architecturally isolated.**
