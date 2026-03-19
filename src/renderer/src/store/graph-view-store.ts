import { create } from 'zustand'
import type { GraphViewport, ForceParams } from '@renderer/panels/graph/graph-types'
import { DEFAULT_FORCE_PARAMS } from '@renderer/panels/graph/graph-types'

interface GraphViewState {
  readonly hoveredNodeId: string | null
  readonly selectedNodeId: string | null
  readonly viewport: GraphViewport
  readonly alpha: number
  readonly settled: boolean
  readonly nodeCount: number
  readonly edgeCount: number

  // Display settings
  readonly showLabels: boolean
  readonly showGhostNodes: boolean
  readonly showEdges: boolean
  readonly showOrphanNodes: boolean
  readonly nodeScale: number
  readonly labelScale: number

  // Force params
  readonly forceParams: ForceParams

  setHoveredNode: (id: string | null) => void
  setSelectedNode: (id: string | null) => void
  setViewport: (viewport: GraphViewport) => void
  setSimulationState: (alpha: number, settled: boolean) => void
  setGraphStats: (nodeCount: number, edgeCount: number) => void
  setShowLabels: (show: boolean) => void
  setShowGhostNodes: (show: boolean) => void
  setShowEdges: (show: boolean) => void
  setShowOrphanNodes: (show: boolean) => void
  setNodeScale: (scale: number) => void
  setLabelScale: (scale: number) => void
  setForceParams: (params: Partial<ForceParams>) => void
  resetForceParams: () => void
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
  showGhostNodes: true,
  showEdges: true,
  showOrphanNodes: true,
  nodeScale: 1.0,
  labelScale: 1.0,
  forceParams: DEFAULT_FORCE_PARAMS
}

export const useGraphViewStore = create<GraphViewState>((set, get) => ({
  ...INITIAL_STATE,

  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setViewport: (viewport) => set({ viewport }),
  setSimulationState: (alpha, settled) => set({ alpha, settled }),
  setGraphStats: (nodeCount, edgeCount) => set({ nodeCount, edgeCount }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowGhostNodes: (show) => set({ showGhostNodes: show }),
  setShowEdges: (show) => set({ showEdges: show }),
  setShowOrphanNodes: (show) => set({ showOrphanNodes: show }),
  setNodeScale: (scale) => set({ nodeScale: scale }),
  setLabelScale: (scale) => set({ labelScale: scale }),
  setForceParams: (params) => set({ forceParams: { ...get().forceParams, ...params } }),
  resetForceParams: () => set({ forceParams: DEFAULT_FORCE_PARAMS }),
  reset: () => set(INITIAL_STATE)
}))
