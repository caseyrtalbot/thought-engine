import { useState, useEffect, useRef, useCallback } from 'react'
import { useVaultStore } from '@renderer/store/vault-store'
import { useEditorStore } from '@renderer/store/editor-store'
import { useGraphViewStore } from '@renderer/store/graph-view-store'
import { GraphRenderer } from './graph-renderer'
import { LabelLayer } from './graph-label-layer'
import { GraphSettingsPanel } from './GraphSettingsPanel'
import { getGraphLod } from './graph-lod'
import type { SimNode, PhysicsCommand, PhysicsResult, ForceParams } from './graph-types'
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

        // Re-render labels on viewport change (zoom/pan)
        const ll = labelLayerRef.current
        if (ll && positionsRef.current.length > 0) {
          const lod = getGraphLod(vp.scale)
          const hoveredId = useGraphViewStore.getState().hoveredNodeId
          const hoveredIdx = hoveredId ? (nodeIndexMapRef.current.get(hoveredId) ?? null) : null
          const ns = hoveredIdx !== null ? getNeighborSet(hoveredIdx) : null
          const { showLabels, labelScale } = useGraphViewStore.getState()
          ll.render(
            simNodesRef.current,
            positionsRef.current,
            vp,
            lod,
            hoveredIdx,
            ns,
            showLabels,
            labelScale
          )
        }
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

        const { showLabels, labelScale } = useGraphViewStore.getState()
        labelLayer.render(
          simNodesRef.current,
          msg.buffer,
          vp,
          lod,
          hoveredIdx,
          neighborSet,
          showLabels,
          labelScale
        )
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

  // Reactively apply display options to the renderer
  const showEdges = useGraphViewStore((s) => s.showEdges)
  const showGhostNodes = useGraphViewStore((s) => s.showGhostNodes)
  const showOrphanNodes = useGraphViewStore((s) => s.showOrphanNodes)
  const nodeScale = useGraphViewStore((s) => s.nodeScale)

  useEffect(() => {
    rendererRef.current?.setDisplayOptions({
      showEdges,
      showGhostNodes,
      showOrphanNodes,
      nodeScale
    })
  }, [showEdges, showGhostNodes, showOrphanNodes, nodeScale])

  // Settings panel toggle
  const [showSettings, setShowSettings] = useState(false)

  // Send force param changes to worker
  const handleForceParamsChange = useCallback((params: Partial<ForceParams>) => {
    if (!workerRef.current) return
    const cmd: PhysicsCommand = { type: 'update-params', params }
    workerRef.current.postMessage(cmd)
  }, [])

  // Reheat the simulation
  const handleReheat = useCallback(() => {
    if (!workerRef.current) return
    const cmd: PhysicsCommand = { type: 'reheat', alpha: 0.5 }
    workerRef.current.postMessage(cmd)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Settings toggle button */}
      <button
        onClick={() => setShowSettings((prev) => !prev)}
        className="absolute top-3 right-3 z-20 flex items-center justify-center rounded-lg transition-all"
        style={{
          width: 32,
          height: 32,
          backgroundColor: showSettings ? 'var(--color-accent-default)' : 'rgba(20, 20, 20, 0.85)',
          border: '1px solid var(--color-border-default)',
          color: showSettings ? '#141414' : 'var(--color-text-secondary)',
          backdropFilter: 'blur(8px)'
        }}
        title="Graph settings"
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Collapsible settings panel */}
      {showSettings && (
        <GraphSettingsPanel onForceParamsChange={handleForceParamsChange} onReheat={handleReheat} />
      )}
    </div>
  )
}
