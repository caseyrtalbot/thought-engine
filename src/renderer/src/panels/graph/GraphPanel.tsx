import { useEffect, useRef, useCallback } from 'react'
import { useVaultStore } from '@renderer/store/vault-store'
import { useEditorStore } from '@renderer/store/editor-store'
import { useGraphViewStore } from '@renderer/store/graph-view-store'
import { GraphRenderer } from './graph-renderer'
import { LabelLayer } from './graph-label-layer'
import { getGraphLod } from './graph-lod'
import type { SimNode, PhysicsCommand, PhysicsResult } from './graph-types'
import type { KnowledgeGraph } from '@shared/types'

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
      isGhost: !n.path
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

  const setHoveredNode = useGraphViewStore((s) => s.setHoveredNode)
  const setSelectedNode = useGraphViewStore((s) => s.setSelectedNode)
  const setSimulationState = useGraphViewStore((s) => s.setSimulationState)
  const setViewportStore = useGraphViewStore((s) => s.setViewport)
  const setGraphStats = useGraphViewStore((s) => s.setGraphStats)

  // Helper: get neighbor indices from cached edges
  const getNeighborSet = useCallback((nodeIndex: number): Set<number> => {
    const neighbors = new Set<number>([nodeIndex])
    for (const edge of edgesRef.current) {
      if (edge.source === nodeIndex) neighbors.add(edge.target)
      if (edge.target === nodeIndex) neighbors.add(edge.source)
    }
    return neighbors
  }, [])

  // Mount renderer + worker once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    mountedRef.current = true

    const renderer = new GraphRenderer({
      onNodeHover: (idx) => {
        if (!mountedRef.current) return
        const id = idx !== null ? (simNodesRef.current[idx]?.id ?? null) : null
        setHoveredNode(id)
        renderer.setHighlightedNode(idx)
      },
      onNodeClick: (idx) => {
        if (!mountedRef.current) return
        const node = simNodesRef.current[idx]
        if (!node) return

        setSelectedNode(node.id)

        // Find the file path for this artifact and navigate
        const currentFileToId = useVaultStore.getState().fileToId
        const path = Object.entries(currentFileToId).find(([, id]) => id === node.id)?.[0]
        if (path) {
          useEditorStore.getState().setActiveNote(node.id, path)
          // Don't switch view - let user stay on graph or use split view
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
        setViewportStore(vp)
      }
    })

    renderer.mount(container)
    rendererRef.current = renderer

    const labelLayer = new LabelLayer()
    labelLayer.mount(container)
    labelLayerRef.current = labelLayer

    // Spawn physics worker
    const worker = new Worker(new URL('@engine/graph-physics-worker.ts', import.meta.url), {
      type: 'module'
    })

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
        const hoveredIdx = hoveredId ? (nodeIndexMapRef.current.get(hoveredId) ?? null) : null
        const neighborSet = hoveredIdx !== null ? getNeighborSet(hoveredIdx) : null

        labelLayer.render(simNodesRef.current, msg.buffer, vp, lod, hoveredIdx, neighborSet)
      }
    }

    workerRef.current = worker

    // Resize observer for label layer
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- Mount once

  // Send graph data to worker when it changes
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
  }, [graph, setGraphStats])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    />
  )
}
