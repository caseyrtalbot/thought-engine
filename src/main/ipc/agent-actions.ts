import { typedHandle, typedSend } from '../typed-ipc'
import { runAgentAction, cancelAgentAction } from '../services/agent-action-runner'
import { getMainWindow } from '../window-registry'

export function registerAgentActionIpc(): void {
  typedHandle('agent-action:compute', async (request) => {
    return runAgentAction(request, undefined, (ev) => {
      const window = getMainWindow()
      if (window) typedSend(window, 'agent-action:stream', ev)
    })
  })

  typedHandle('agent-action:cancel', () => {
    cancelAgentAction()
  })
}
