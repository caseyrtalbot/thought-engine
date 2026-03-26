import type { BrowserWindow } from 'electron'
import type { TmuxMonitor } from '../services/tmux-monitor'
import type { AgentSpawner } from '../services/agent-spawner'
import { typedHandle, typedSend } from '../typed-ipc'

export function registerAgentIpc(
  window: BrowserWindow,
  monitor: TmuxMonitor | null,
  spawner?: AgentSpawner | null
): void {
  typedHandle('agent:get-states', async () => {
    if (!monitor) return []
    return monitor.getAgentStates()
  })

  typedHandle('agent:spawn', async (request) => {
    if (!spawner) return { error: 'Agent spawner not available' }
    const sessionId = spawner.spawn(request)
    return { sessionId }
  })

  if (monitor) {
    monitor.start((states) => {
      typedSend(window, 'agent:states-changed', { states })
    })
  }
}
