import { useEffect } from 'react'
import { useCanvasStore } from '../store/canvas-store'

/**
 * Subscribes to canvas:agent-plan-accepted IPC events and applies
 * validated agent mutation plans to the canvas store.
 * Mount this hook in any component that should receive agent canvas mutations.
 */
export function useAgentPlanListener(): void {
  useEffect(() => {
    const unsubscribe = window.api.on.canvasAgentPlanAccepted((data) => {
      useCanvasStore.getState().applyAgentPlan(data.plan)
    })

    return unsubscribe
  }, [])
}
