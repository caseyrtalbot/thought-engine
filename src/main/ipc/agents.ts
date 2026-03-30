import type { TmuxMonitor } from '../services/tmux-monitor'
import type { AgentSpawner } from '../services/agent-spawner'
import { typedHandle, typedSend } from '../typed-ipc'
import { getMainWindow } from '../window-registry'

/**
 * Mutable refs for agent services. Updated when vaults are opened/switched
 * without re-registering IPC handlers (Electron throws on duplicate handlers).
 */
let activeMonitor: TmuxMonitor | null = null
let activeSpawner: AgentSpawner | null = null

/**
 * Register agent IPC handlers ONCE at app startup.
 * Handlers reference the mutable refs so they always use the current services.
 */
export function registerAgentIpc(): void {
  typedHandle('agent:get-states', async () => {
    if (!activeMonitor) return []
    return activeMonitor.getAgentStates()
  })

  typedHandle('agent:spawn', async (request) => {
    if (!activeSpawner) return { error: 'Agent spawner not available' }
    const sessionId = activeSpawner.spawn(request)
    return { sessionId }
  })
}

/**
 * Update the agent services when a vault is opened or switched.
 * Starts the monitor polling and pushes state changes to the renderer.
 */
export function setAgentServices(monitor: TmuxMonitor | null, spawner: AgentSpawner | null): void {
  // Stop previous monitor if switching vaults
  activeMonitor?.stop()

  activeMonitor = monitor
  activeSpawner = spawner

  if (monitor) {
    monitor.start((states) => {
      const window = getMainWindow()
      if (window) {
        typedSend(window, 'agent:states-changed', { states })
      }
    })
  }
}

/** Stop the active monitor (for cleanup on quit). */
export function stopAgentServices(): void {
  activeMonitor?.stop()
  activeMonitor = null
  activeSpawner = null
}
