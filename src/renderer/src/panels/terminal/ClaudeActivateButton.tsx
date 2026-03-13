import { colors, transitions } from '../../design/tokens'

const CLAUDE_PURPLE = '#A78BFA'

interface ClaudeActivateButtonProps {
  onClick: () => void
  isActive: boolean
  disabled: boolean
}

export function ClaudeActivateButton({ onClick, isActive, disabled }: ClaudeActivateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        border: disabled ? `1px solid ${colors.text.muted}` : `1px solid ${CLAUDE_PURPLE}`,
        backgroundColor: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
        color: disabled ? colors.text.muted : CLAUDE_PURPLE,
        boxShadow: disabled
          ? 'none'
          : isActive
            ? `0 0 12px rgba(167,139,250,0.3)`
            : `0 0 8px rgba(167,139,250,0.15)`,
        transition: transitions.default
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        const el = e.currentTarget
        el.style.backgroundColor = isActive
          ? 'rgba(167,139,250,0.15)'
          : 'rgba(167,139,250,0.1)'
        el.style.boxShadow = '0 0 12px rgba(167,139,250,0.3)'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        const el = e.currentTarget
        el.style.backgroundColor = isActive ? 'rgba(167,139,250,0.12)' : 'transparent'
        el.style.boxShadow = isActive
          ? '0 0 12px rgba(167,139,250,0.3)'
          : '0 0 8px rgba(167,139,250,0.15)'
      }}
    >
      {/* Sparkle icon */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 0L7.2 4.8L12 6L7.2 7.2L6 12L4.8 7.2L0 6L4.8 4.8L6 0Z"
          fill="currentColor"
        />
      </svg>
      Claude
    </button>
  )
}
