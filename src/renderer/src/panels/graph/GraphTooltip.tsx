// ---------------------------------------------------------------------------
// GraphTooltip: floating label shown on node hover
// ---------------------------------------------------------------------------

export interface TooltipState {
  x: number
  y: number
  label: string
  connectionCount: number
}

interface GraphTooltipProps {
  tooltip: TooltipState
}

export function GraphTooltip({ tooltip }: GraphTooltipProps) {
  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{
        left: tooltip.x + 12,
        top: tooltip.y - 8,
        backgroundColor: 'rgba(20, 20, 30, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        padding: '6px 10px',
        maxWidth: 240
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 500 }}>
        {tooltip.label}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
        {tooltip.connectionCount} connection{tooltip.connectionCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
