import { canvasTokens } from '../../../design/tokens'
import { typography } from '../../../design/tokens'

interface CardBadgeProps {
  readonly label: string
  readonly color?: string
}

export function CardBadge({ label, color = canvasTokens.badgeGreen }: CardBadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: color,
        color: '#ffffff',
        fontSize: 10,
        fontFamily: typography.fontFamily.mono,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '4px 8px',
        borderRadius: 3,
        lineHeight: 1,
        userSelect: 'none'
      }}
    >
      {label}
    </span>
  )
}
