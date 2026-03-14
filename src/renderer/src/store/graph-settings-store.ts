import { create } from 'zustand'
import type { ArtifactType } from '@shared/types'
import { ARTIFACT_COLORS } from '../design/tokens'

export type NodeSizeMode = 'degree' | 'uniform' | 'content'

interface GroupConfig {
  visible: boolean
  color: string
}

interface GraphSettingsState {
  showOrphans: boolean
  showExistingOnly: boolean
  showTags: boolean
  baseNodeSize: number
  nodeSizeMode: NodeSizeMode
  linkOpacity: number
  linkThickness: number
  showArrows: boolean
  textFadeThreshold: number
  isAnimating: boolean
  showMinimap: boolean
  centerForce: number
  repelForce: number
  linkForce: number
  linkDistance: number
  groups: Record<ArtifactType, GroupConfig>
  setShowOrphans: (value: boolean) => void
  setShowExistingOnly: (value: boolean) => void
  setShowTags: (value: boolean) => void
  setBaseNodeSize: (value: number) => void
  setNodeSizeMode: (value: NodeSizeMode) => void
  setLinkOpacity: (value: number) => void
  setLinkThickness: (value: number) => void
  setShowArrows: (value: boolean) => void
  setTextFadeThreshold: (value: number) => void
  setIsAnimating: (value: boolean) => void
  setShowMinimap: (value: boolean) => void
  setCenterForce: (value: number) => void
  setRepelForce: (value: number) => void
  setLinkForce: (value: number) => void
  setLinkDistance: (value: number) => void
  setGroupVisible: (type: ArtifactType, visible: boolean) => void
  setGroupColor: (type: ArtifactType, color: string) => void
}

const DEFAULT_GROUPS: Record<ArtifactType, GroupConfig> = {
  gene: { visible: true, color: ARTIFACT_COLORS.gene },
  constraint: { visible: true, color: ARTIFACT_COLORS.constraint },
  research: { visible: true, color: ARTIFACT_COLORS.research },
  output: { visible: true, color: ARTIFACT_COLORS.output },
  note: { visible: true, color: ARTIFACT_COLORS.note },
  index: { visible: true, color: ARTIFACT_COLORS.index }
}

export const useGraphSettingsStore = create<GraphSettingsState>()((set, get) => ({
  showOrphans: false,
  showExistingOnly: false,
  showTags: true,
  baseNodeSize: 5,
  nodeSizeMode: 'degree',
  linkOpacity: 0.15,
  linkThickness: 0.5,
  showArrows: false,
  textFadeThreshold: 1.2,
  isAnimating: true,
  showMinimap: true,
  centerForce: 0.3,
  repelForce: -80,
  linkForce: 0.2,
  linkDistance: 60,
  groups: DEFAULT_GROUPS,

  setShowOrphans: (value) => set({ showOrphans: value }),
  setShowExistingOnly: (value) => set({ showExistingOnly: value }),
  setShowTags: (value) => set({ showTags: value }),
  setBaseNodeSize: (value) => set({ baseNodeSize: value }),
  setNodeSizeMode: (value) => set({ nodeSizeMode: value }),
  setLinkOpacity: (value) => set({ linkOpacity: value }),
  setLinkThickness: (value) => set({ linkThickness: value }),
  setShowArrows: (value) => set({ showArrows: value }),
  setTextFadeThreshold: (value) => set({ textFadeThreshold: value }),
  setIsAnimating: (value) => set({ isAnimating: value }),
  setShowMinimap: (value) => set({ showMinimap: value }),
  setCenterForce: (value) => set({ centerForce: value }),
  setRepelForce: (value) => set({ repelForce: value }),
  setLinkForce: (value) => set({ linkForce: value }),
  setLinkDistance: (value) => set({ linkDistance: value }),

  setGroupVisible: (type, visible) => {
    const groups = { ...get().groups }
    groups[type] = { ...groups[type], visible }
    set({ groups })
  },

  setGroupColor: (type, color) => {
    const groups = { ...get().groups }
    groups[type] = { ...groups[type], color }
    set({ groups })
  }
}))
