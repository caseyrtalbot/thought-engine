import type { BuiltInArtifactType } from '@shared/types'

export const colors = {
  bg: {
    base: '#0c0e14',
    surface: '#141620',
    elevated: '#1c1f2e'
  },
  border: {
    default: '#252a3a',
    subtle: 'rgba(255, 255, 255, 0.08)'
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#64748b',
    muted: '#3b4563'
  },
  accent: {
    default: '#00e5bf',
    hover: '#33eece',
    muted: 'rgba(0, 229, 191, 0.10)'
  },
  semantic: {
    cluster: '#34D399',
    tension: '#F59E0B'
  }
} as const

export const ARTIFACT_COLORS: Record<BuiltInArtifactType, string> = {
  gene: '#22d3ee',
  constraint: '#ef4444',
  research: '#a78bfa',
  output: '#f472b6',
  note: '#64748b',
  index: '#38bdf8'
}

export const DEFAULT_ARTIFACT_COLOR = '#64748b'

export function getArtifactColor(type: string): string {
  return (ARTIFACT_COLORS as Record<string, string>)[type] ?? DEFAULT_ARTIFACT_COLOR
}

export const spacing = {
  unit: 4,
  panelGap: 4,
  contentPadX: 32,
  contentPadY: 24,
  sidebarWidth: 260,
  terminalMinWidth: 320
} as const

export const typography = {
  fontFamily: {
    display: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace'
  },
  metadata: {
    size: '11px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const
  }
} as const

export const transitions = {
  default: '150ms ease-out',
  hover: '150ms ease-out',
  tooltip: '100ms ease-in',
  focusRing: '100ms ease-out',
  settingsSlide: '250ms ease-out',
  modalFade: '200ms ease-in',
  commandPalette: '150ms ease-out'
} as const

export const typeScale = {
  display: {
    pageTitle: { size: '20px', weight: 600, color: colors.text.primary },
    sectionHeading: { size: '15px', weight: 600, color: colors.text.primary },
    body: { size: '13px', weight: 400, color: colors.text.primary },
    secondary: { size: '12px', weight: 400, color: colors.text.secondary },
    label: {
      size: '12px',
      weight: 400,
      color: colors.text.muted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em'
    }
  },
  mono: { terminal: { size: '13px' }, source: { size: '12px' }, inline: { size: '12px' } },
  minSize: '12px'
} as const

export const borderRadius = { container: 6, inline: 4, card: 8, round: '50%' } as const

/* ── Visual Language ──────────────────────────────────────────────────────
 * Named tokens for the floating-card panel aesthetic.
 * Use these in CSS via var(--panel-gap), var(--card-radius), var(--border-subtle).
 *
 * Panels render as cards inset from the app chrome and each other by --panel-gap.
 * Depth comes from background-contrast (surface on base), not drop shadows.
 * Tab bars use --border-subtle for their 1px bottom separator.
 */
export const visualLanguage = {
  panelGap: 4,
  cardRadius: 8,
  borderSubtle: 'rgba(255, 255, 255, 0.08)'
} as const

export const animations = {
  graphNodeHoverGlow: '200ms ease-out',
  graphNetworkReveal: '200ms ease-out',
  graphNetworkDim: '300ms ease-out',
  graphNodeEnter: '400ms ease-out',
  graphNodeExit: '200ms ease-out',
  spatialTransition: '250ms ease-out'
} as const

export const focusRing = {
  color: colors.accent.default,
  opacity: 0.3,
  offset: 2,
  width: 2
} as const
