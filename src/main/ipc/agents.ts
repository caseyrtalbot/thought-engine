import type { PtyMonitor } from '../services/pty-monitor'
import type { AgentSpawner } from '../services/agent-spawner'
import { LibrarianMonitor } from '../services/librarian-monitor'
import { typedHandle, typedSend } from '../typed-ipc'
import { getMainWindow } from '../window-registry'

let activeMonitor: PtyMonitor | null = null
let activeSpawner: AgentSpawner | null = null
let librarianMonitor: LibrarianMonitor | null = null

export function registerAgentIpc(): void {
  typedHandle('agent:get-states', async () => {
    const ptyStates = activeMonitor ? activeMonitor.getAgentStates() : []
    const librarianStates = librarianMonitor ? librarianMonitor.getStates() : []
    return [...ptyStates, ...librarianStates]
  })

  typedHandle('agent:spawn', async (request) => {
    if (!activeSpawner) return { error: 'Agent spawner not available' }

    // Dispatch librarian spawns to the direct child_process path
    if (request.type === 'librarian') {
      return activeSpawner.spawnLibrarian(request.cwd, request.selectedFiles)
    }

    // Dispatch curator spawns to the direct child_process path
    if (request.type === 'curator') {
      return activeSpawner.spawnCurator(
        request.cwd,
        request.curatorMode ?? 'emerge',
        request.selectedFiles
      )
    }

    const sessionId = activeSpawner.spawn(request)
    return { sessionId }
  })

  typedHandle('agent:kill', async ({ sessionId }) => {
    librarianMonitor?.kill(sessionId)
  })
}

export function setAgentServices(monitor: PtyMonitor | null, spawner: AgentSpawner | null): void {
  activeMonitor?.stop()

  activeMonitor = monitor
  activeSpawner = spawner

  // Create and wire the librarian monitor
  librarianMonitor = new LibrarianMonitor()
  spawner?.setLibrarianMonitor(librarianMonitor)

  // Push librarian state changes to the renderer
  librarianMonitor.setOnChange((librarianStates) => {
    const window = getMainWindow()
    if (window) {
      const ptyStates = activeMonitor ? activeMonitor.getAgentStates() : []
      typedSend(window, 'agent:states-changed', {
        states: [...ptyStates, ...librarianStates]
      })
    }
  })

  if (monitor) {
    monitor.start((ptyStates) => {
      const window = getMainWindow()
      if (window) {
        const ls = librarianMonitor ? librarianMonitor.getStates() : []
        typedSend(window, 'agent:states-changed', {
          states: [...ptyStates, ...ls]
        })
      }
    })
  }
}

export function stopAgentServices(): void {
  activeMonitor?.stop()
  activeMonitor = null
  activeSpawner = null
  librarianMonitor?.killAll()
  librarianMonitor = null
}
