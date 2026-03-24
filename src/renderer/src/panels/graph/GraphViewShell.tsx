import { GraphPanel } from './GraphPanel'
import { GraphDetailDrawer } from './GraphDetailDrawer'

export function GraphViewShell() {
  return (
    <div className="relative w-full h-full">
      <GraphPanel />
      <GraphDetailDrawer />
    </div>
  )
}
