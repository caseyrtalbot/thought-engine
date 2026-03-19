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
