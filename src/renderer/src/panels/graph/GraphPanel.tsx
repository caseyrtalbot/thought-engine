import { useRef, useEffect, useCallback, useState } from 'react'
import { zoom, type D3ZoomEvent } from 'd3-zoom'
import { select } from 'd3-selection'
import { useVaultStore } from '../../store/vault-store'
import { useGraphStore } from '../../store/graph-store'
import { useGraphSettingsStore } from '../../store/graph-settings-store'
import {
  createSimulation,
  renderGraph,
  findNodeAt,
  type SimNode,
  type SimEdge,
  type RenderConfig
} from './GraphRenderer'
import { GraphSettingsPanel } from './GraphSettingsPanel'
import { colors } from '../../design/tokens'

interface GraphPanelProps {
  onNodeClick: (id: string) => void
}

export function GraphPanel({ onNodeClick }: GraphPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<ReturnType<typeof createSimulation> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const edgesRef = useRef<SimEdge[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })

  const [settingsOpen, setSettingsOpen] = useState(false)

  const graph = useVaultStore((s) => s.graph)
  const fileToId = useVaultStore((s) => s.fileToId)
  const { selectedNodeId, hoveredNodeId, setSelectedNode, setHoveredNode } = useGraphStore()

  // Graph settings - narrow selectors
  const showOrphans = useGraphSettingsStore((s) => s.showOrphans)
  const showExistingOnly = useGraphSettingsStore((s) => s.showExistingOnly)
  const baseNodeSize = useGraphSettingsStore((s) => s.baseNodeSize)
  const linkOpacity = useGraphSettingsStore((s) => s.linkOpacity)
  const linkThickness = useGraphSettingsStore((s) => s.linkThickness)
  const showArrows = useGraphSettingsStore((s) => s.showArrows)
  const textFadeThreshold = useGraphSettingsStore((s) => s.textFadeThreshold)
  const isAnimating = useGraphSettingsStore((s) => s.isAnimating)
  const centerForce = useGraphSettingsStore((s) => s.centerForce)
  const repelForce = useGraphSettingsStore((s) => s.repelForce)
  const linkForceStrength = useGraphSettingsStore((s) => s.linkForce)
  const linkDistance = useGraphSettingsStore((s) => s.linkDistance)
  const groups = useGraphSettingsStore((s) => s.groups)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const groupColors = Object.fromEntries(
      Object.entries(groups).map(([type, cfg]) => [type, cfg.color])
    )

    const renderConfig: RenderConfig = {
      baseNodeSize,
      linkOpacity,
      linkThickness,
      showArrows,
      textFadeThreshold,
      zoomLevel: transformRef.current.k,
      groupColors
    }

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const t = transformRef.current
    ctx.translate(t.x, t.y)
    ctx.scale(t.k, t.k)
    renderGraph(
      ctx,
      nodesRef.current,
      edgesRef.current,
      canvas.width,
      canvas.height,
      selectedNodeId,
      hoveredNodeId,
      renderConfig
    )
    ctx.restore()
  }, [
    selectedNodeId,
    hoveredNodeId,
    baseNodeSize,
    linkOpacity,
    linkThickness,
    showArrows,
    textFadeThreshold,
    groups
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Build set of existing node IDs from fileToId mapping
    const existingNodeIds = new Set(Object.values(fileToId))

    // Start with all nodes and apply filters
    let filteredNodes = graph.nodes.map((n) => ({
      ...n,
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height
    })) as SimNode[]

    let filteredEdges: SimEdge[] = graph.edges.map((e) => ({ ...e }))

    // Filter out nodes whose group visibility is false
    filteredNodes = filteredNodes.filter((n) => {
      const groupCfg = groups[n.type]
      return groupCfg ? groupCfg.visible : true
    })

    // showExistingOnly: keep only nodes that map to a real vault file
    if (showExistingOnly) {
      filteredNodes = filteredNodes.filter((n) => existingNodeIds.has(n.id))
    }

    // showOrphans: if false, keep only nodes that appear in at least one edge
    if (!showOrphans) {
      const connectedIds = new Set<string>()
      for (const edge of filteredEdges) {
        const srcId = typeof edge.source === 'string' ? edge.source : edge.source.id
        const tgtId = typeof edge.target === 'string' ? edge.target : edge.target.id
        connectedIds.add(srcId)
        connectedIds.add(tgtId)
      }
      filteredNodes = filteredNodes.filter((n) => connectedIds.has(n.id))
    }

    // Filter edges to only those connecting remaining nodes
    const nodeIdSet = new Set(filteredNodes.map((n) => n.id))
    filteredEdges = filteredEdges.filter((e) => {
      const srcId = typeof e.source === 'string' ? e.source : e.source.id
      const tgtId = typeof e.target === 'string' ? e.target : e.target.id
      return nodeIdSet.has(srcId) && nodeIdSet.has(tgtId)
    })

    nodesRef.current = filteredNodes
    edgesRef.current = filteredEdges

    let sim: ReturnType<typeof createSimulation> | null = null
    if (filteredNodes.length > 0) {
      sim = createSimulation(filteredNodes, filteredEdges, canvas.width, canvas.height, {
        centerForce,
        repelForce,
        linkForce: linkForceStrength,
        linkDistance
      })
      if (!isAnimating) {
        sim.stop()
      }
      sim.on('tick', render)
      simRef.current = sim
    } else {
      render()
    }

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform
        render()
      })

    const selection = select(canvas).call(zoomBehavior)

    return () => {
      sim?.stop()
      selection.on('.zoom', null)
    }
  }, [
    graph,
    render,
    fileToId,
    showOrphans,
    showExistingOnly,
    groups,
    centerForce,
    repelForce,
    linkForceStrength,
    linkDistance,
    isAnimating
  ])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const t = transformRef.current
      const x = (e.clientX - rect.left - t.x) / t.k
      const y = (e.clientY - rect.top - t.y) / t.k
      const node = findNodeAt(nodesRef.current, x, y)
      setHoveredNode(node?.id ?? null)
      canvas.style.cursor = node ? 'pointer' : 'default'
    },
    [setHoveredNode]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const t = transformRef.current
      const x = (e.clientX - rect.left - t.x) / t.k
      const y = (e.clientY - rect.top - t.y) / t.k
      const node = findNodeAt(nodesRef.current, x, y)
      if (node) {
        setSelectedNode(node.id)
        onNodeClick(node.id)
      } else {
        setSelectedNode(null)
      }
    },
    [setSelectedNode, onNodeClick]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth * window.devicePixelRatio
      canvas.height = canvas.clientHeight * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      render()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [render])

  const isEmpty = graph.nodes.length === 0

  return (
    <div className="h-full relative" style={{ backgroundColor: colors.bg.base }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ backgroundColor: colors.bg.base }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Settings toggle button */}
      <button
        type="button"
        onClick={() => setSettingsOpen((prev) => !prev)}
        className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded transition-colors duration-150 focus:outline-none"
        style={{
          backgroundColor: settingsOpen ? colors.accent.muted : colors.bg.elevated,
          color: settingsOpen ? colors.accent.default : colors.text.muted,
          border: `1px solid ${colors.border.default}`
        }}
        aria-label="Toggle graph settings"
        title="Graph Settings"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.3 6.5a1 1 0 0 0 .2-1.1l-.9-1.6a1 1 0 0 0-1-.5l-1.1.2a5 5 0 0 0-.9-.5l-.3-1.1A1 1 0 0 0 8.3 1h-1.6a1 1 0 0 0-1 .9L5.5 3a5 5 0 0 0-.9.5l-1.1-.2a1 1 0 0 0-1 .5L1.6 5.4a1 1 0 0 0 .2 1.1l.8.8v.6l-.8.8a1 1 0 0 0-.2 1.1l.9 1.6a1 1 0 0 0 1 .5l1.1-.2c.3.2.6.4.9.5l.3 1.1a1 1 0 0 0 1 .7h1.6a1 1 0 0 0 1-.9l.2-1.1c.3-.1.6-.3.9-.5l1.1.2a1 1 0 0 0 1-.5l.9-1.6a1 1 0 0 0-.2-1.1l-.8-.8V7.3l.8-.8Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Graph settings panel */}
      <GraphSettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {isEmpty && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ color: colors.text.muted }}
        >
          <div className="text-center">
            <p className="text-lg mb-2">No notes yet</p>
            <p className="text-sm">Create a note to see your knowledge graph</p>
          </div>
        </div>
      )}
    </div>
  )
}
