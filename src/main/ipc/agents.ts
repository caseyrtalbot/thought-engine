import type { BrowserWindow } from 'electron'
import type { TmuxMonitor } from '../services/tmux-monitor'
import { typedHandle, typedSend } from '../typed-ipc'

export function registerAgentIpc(window: BrowserWindow, monitor: TmuxMonitor | null): void {
  typedHandle('agent:get-states', async () => {
    if (!monitor) return []
    return monitor.getAgentStates()
  })

  if (monitor) {
    monitor.start((states) => {
      typedSend(window, 'agent:states-changed', { states })
    })
  }
}
