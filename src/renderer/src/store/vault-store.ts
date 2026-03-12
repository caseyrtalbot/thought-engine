import { create } from 'zustand'
import type { Artifact, VaultConfig, VaultState, KnowledgeGraph } from '@shared/types'
import { VaultIndex } from '../engine/indexer'
import { deriveCounters } from '../engine/id-generator'

interface VaultFile {
  path: string
  filename: string
  title: string
  modified: string
}

interface VaultStore {
  vaultPath: string | null
  config: VaultConfig | null
  state: VaultState | null
  files: VaultFile[]
  index: VaultIndex
  activeWorkspace: string | null
  isLoading: boolean

  setVaultPath: (path: string) => void
  setConfig: (config: VaultConfig) => void
  setState: (state: VaultState) => void
  setFiles: (files: VaultFile[]) => void
  setActiveWorkspace: (workspace: string | null) => void
  getGraph: () => KnowledgeGraph
  getArtifact: (id: string) => Artifact | undefined
  search: (query: string) => Artifact[]
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  vaultPath: null,
  config: null,
  state: null,
  files: [],
  index: new VaultIndex(),
  activeWorkspace: null,
  isLoading: false,

  setVaultPath: (path) => set({ vaultPath: path }),
  setConfig: (config) => set({ config }),
  setState: (state) => set({ state }),
  setFiles: (files) => set({ files }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  getGraph: () => get().index.getGraph(),
  getArtifact: (id) => get().index.getArtifact(id),
  search: (query) => get().index.search(query),
}))
