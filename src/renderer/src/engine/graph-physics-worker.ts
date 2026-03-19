import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force'
import type {
  SimNode,
  ForceParams,
  PhysicsCommand,
  PhysicsResult
} from '@renderer/panels/graph/graph-types'
import { DEFAULT_FORCE_PARAMS } from '@renderer/panels/graph/graph-types'
import type { RelationshipKind } from '@shared/types'

/** Minimal Worker global scope for type-safe postMessage in Web Worker context */
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent) => void) | null
}

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
  source: number
  target: number
  kind: RelationshipKind
}

interface TickResult {
  readonly buffer: Float32Array
  readonly alpha: number
  readonly settled: boolean
}

interface PhysicsEngine {
  init(
    nodes: ReadonlyArray<SimNode>,
    edges: ReadonlyArray<{ source: number; target: number; kind: RelationshipKind }>
  ): void
  tick(): TickResult
  drag(nodeIndex: number, x: number, y: number): void
  dragEnd(nodeIndex: number): void
  reheat(alpha?: number): void
  updateParams(params: Partial<ForceParams>): void
}

function initCircleLayout(count: number): ReadonlyArray<{ x: number; y: number }> {
  const radius = Math.sqrt(count) * 30
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }
  })
}

export function createPhysicsEngine(): PhysicsEngine {
  let d3Nodes: D3Node[] = []
  let simulation: ReturnType<typeof forceSimulation<D3Node>> | null = null

  function init(
    nodes: ReadonlyArray<SimNode>,
    edges: ReadonlyArray<{ source: number; target: number; kind: RelationshipKind }>
  ): void {
    const positions = initCircleLayout(nodes.length)

    d3Nodes = nodes.map((n, i) => ({
      index: i,
      x: positions[i].x,
      y: positions[i].y,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      id: n.id
    }))

    const links: D3Link[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind
    }))

    simulation = forceSimulation<D3Node>(d3Nodes)
      .force(
        'charge',
        forceManyBody<D3Node>().strength(DEFAULT_FORCE_PARAMS.repelStrength).distanceMax(600)
      )
      .force(
        'link',
        forceLink<D3Node, D3Link>(links)
          .id((d) => d.index)
          .distance(DEFAULT_FORCE_PARAMS.linkDistance)
          .strength(DEFAULT_FORCE_PARAMS.linkStrength)
      )
      .force('center', forceCenter<D3Node>(0, 0).strength(DEFAULT_FORCE_PARAMS.centerStrength))
      .force('collide', forceCollide<D3Node>(12))
      .velocityDecay(DEFAULT_FORCE_PARAMS.velocityDecay)
      .alphaDecay(DEFAULT_FORCE_PARAMS.alphaDecay)
      .alphaMin(DEFAULT_FORCE_PARAMS.alphaMin)
      .stop()
  }

  function tick(): TickResult {
    if (!simulation || d3Nodes.length === 0) {
      return { buffer: new Float32Array(0), alpha: 0, settled: true }
    }

    simulation.tick()

    const buffer = new Float32Array(d3Nodes.length * 2)
    for (let i = 0; i < d3Nodes.length; i++) {
      buffer[i * 2] = d3Nodes[i].x
      buffer[i * 2 + 1] = d3Nodes[i].y
    }

    const alpha = simulation.alpha()
    const settled = alpha < (simulation.alphaMin() ?? DEFAULT_FORCE_PARAMS.alphaMin)

    return { buffer, alpha, settled }
  }

  function drag(nodeIndex: number, x: number, y: number): void {
    if (!simulation || nodeIndex < 0 || nodeIndex >= d3Nodes.length) return

    d3Nodes[nodeIndex].fx = x
    d3Nodes[nodeIndex].fy = y

    if (simulation.alpha() < 0.1) {
      simulation.alpha(0.3)
    }
  }

  function dragEnd(nodeIndex: number): void {
    if (!simulation || nodeIndex < 0 || nodeIndex >= d3Nodes.length) return

    d3Nodes[nodeIndex].fx = null
    d3Nodes[nodeIndex].fy = null
  }

  function reheat(alpha = 0.5): void {
    if (!simulation) return
    simulation.alpha(alpha)
  }

  function updateParams(params: Partial<ForceParams>): void {
    if (!simulation) return

    if (params.repelStrength !== undefined) {
      const charge = simulation.force('charge') as ReturnType<typeof forceManyBody> | undefined
      if (charge) charge.strength(params.repelStrength)
    }

    if (params.linkDistance !== undefined || params.linkStrength !== undefined) {
      const link = simulation.force('link') as ReturnType<typeof forceLink> | undefined
      if (link) {
        if (params.linkDistance !== undefined) link.distance(params.linkDistance)
        if (params.linkStrength !== undefined) link.strength(params.linkStrength)
      }
    }

    if (params.centerStrength !== undefined) {
      const center = simulation.force('center') as ReturnType<typeof forceCenter> | undefined
      if (center) center.strength(params.centerStrength)
    }

    if (params.velocityDecay !== undefined) {
      simulation.velocityDecay(params.velocityDecay)
    }

    if (params.alphaDecay !== undefined) {
      simulation.alphaDecay(params.alphaDecay)
    }

    if (params.alphaMin !== undefined) {
      simulation.alphaMin(params.alphaMin)
    }

    // Reheat slightly so updated params take effect
    if (simulation.alpha() < 0.1) {
      simulation.alpha(0.3)
    }
  }

  return { init, tick, drag, dragEnd, reheat, updateParams }
}

// ---------------------------------------------------------------------------
// Web Worker entrypoint
// Only runs when this file is loaded as a Worker (not when imported for tests)
// ---------------------------------------------------------------------------

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  // Cast to WorkerScope for correct postMessage signature (not Window's)
  const workerSelf = self as unknown as WorkerScope

  const engine = createPhysicsEngine()
  let tickInterval: ReturnType<typeof setInterval> | null = null

  function startTicking(): void {
    if (tickInterval !== null) return

    tickInterval = setInterval(() => {
      const result = engine.tick()

      const msg: PhysicsResult = {
        type: 'positions',
        buffer: result.buffer,
        alpha: result.alpha,
        settled: result.settled
      }

      workerSelf.postMessage(msg, [result.buffer.buffer])

      if (result.settled) {
        stopTicking()
      }
    }, 16)
  }

  function stopTicking(): void {
    if (tickInterval !== null) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  workerSelf.onmessage = (event: MessageEvent<PhysicsCommand>): void => {
    const cmd = event.data

    switch (cmd.type) {
      case 'init': {
        stopTicking()
        engine.init(cmd.nodes, cmd.edges)
        const ready: PhysicsResult = { type: 'ready' }
        workerSelf.postMessage(ready)
        startTicking()
        break
      }

      case 'drag': {
        engine.drag(cmd.nodeIndex, cmd.x, cmd.y)
        startTicking()
        break
      }

      case 'drag-end': {
        engine.dragEnd(cmd.nodeIndex)
        break
      }

      case 'reheat': {
        engine.reheat(cmd.alpha)
        startTicking()
        break
      }

      case 'stop': {
        stopTicking()
        break
      }

      case 'resume': {
        engine.reheat(0.3)
        startTicking()
        break
      }

      case 'update-params': {
        engine.updateParams(cmd.params)
        startTicking()
        break
      }
    }
  }
}
