import { useCanvasStore } from '../../store/canvas-store'
import { colors, typography } from '../../design/tokens'

export function ZoomIndicator() {
  const zoom = useCanvasStore((s) => s.viewport.zoom)
  const zoomPercent = Math.round(zoom * 100)

  // key={zoomPercent} forces remount on zoom change, restarting the CSS animation.
  // Pure CSS approach: no state, no refs, no effects. The animation holds at
  // opacity 1 for ~1.3s then fades to 0 over ~0.4s.
  return (
    <div
      key={zoomPercent}
      className="absolute bottom-3 right-3 px-2 py-1 rounded-md pointer-events-none"
      style={{
        backgroundColor: 'rgba(20, 20, 22, 0.8)',
        backdropFilter: 'blur(4px)',
        color: colors.text.muted,
        fontFamily: typography.fontFamily.mono,
        fontSize: 11,
        animation: 'te-zoom-fade 1.7s ease forwards',
        zIndex: 10
      }}
    >
      {zoomPercent}%
    </div>
  )
}
