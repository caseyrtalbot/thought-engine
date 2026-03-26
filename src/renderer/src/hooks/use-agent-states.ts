import { useEffect, useState } from 'react'
import type { AgentSidecarState } from '@shared/agent-types'

/**
 * Subscribe to live agent session states from the main process.
 * Fetches initial states on mount, then updates on `agent:states-changed` events.
 */
export function useAgentStates(): readonly AgentSidecarState[] {
  const [states, setStates] = useState<readonly AgentSidecarState[]>([])

  useEffect(() => {
    // Fetch initial states
    void window.api.agent.getStates().then((initial) => {
      setStates(initial)
    })

    // Subscribe to live updates
    const unsubscribe = window.api.on.agentStatesChanged((data) => {
      setStates(data.states)
    })

    return unsubscribe
  }, [])

  return states
}
