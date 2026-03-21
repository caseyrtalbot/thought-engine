import { create } from 'zustand'

type WorkbenchActionHandler = (() => void | Promise<void>) | null

export interface WorkbenchActionRegistration {
  readonly refresh: WorkbenchActionHandler
  readonly fitAll: WorkbenchActionHandler
  readonly addTerminal: WorkbenchActionHandler
  readonly createTension: WorkbenchActionHandler
  readonly savePattern: WorkbenchActionHandler
  readonly endSession: WorkbenchActionHandler
  readonly toggleThread: WorkbenchActionHandler
  readonly selectedNodeCount: number
  readonly milestoneCount: number
  readonly isLive: boolean
  readonly threadOpen: boolean
}

interface WorkbenchActionStore extends WorkbenchActionRegistration {
  readonly setRegistration: (registration: WorkbenchActionRegistration) => void
  readonly reset: () => void
}

const EMPTY_REGISTRATION: WorkbenchActionRegistration = {
  refresh: null,
  fitAll: null,
  addTerminal: null,
  createTension: null,
  savePattern: null,
  endSession: null,
  toggleThread: null,
  selectedNodeCount: 0,
  milestoneCount: 0,
  isLive: false,
  threadOpen: false
}

export const useWorkbenchActionStore = create<WorkbenchActionStore>((set) => ({
  ...EMPTY_REGISTRATION,
  setRegistration: (registration) => set(registration),
  reset: () => set(EMPTY_REGISTRATION)
}))
