export type ThemeId = 'midnight' | 'slate' | 'obsidian' | 'nord' | 'evergreen' | 'light'
export type AccentColorId =
  | 'teal'
  | 'blue'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'cyan'
  | 'orange'

interface StructuralColors {
  bg: { base: string; surface: string; elevated: string }
  border: { default: string; subtle: string }
  text: { primary: string; secondary: string; muted: string }
}

export interface ThemeDefinition {
  label: string
  colors: StructuralColors
}

export interface AccentDefinition {
  label: string
  value: string
}

export interface ResolvedColors {
  bg: { base: string; surface: string; elevated: string }
  border: { default: string; subtle: string }
  text: { primary: string; secondary: string; muted: string }
  accent: { default: string; hover: string; muted: string }
  semantic: { cluster: string; tension: string }
}

// ── Color math ──────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ]
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function lightenHex(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex)
  const lighten = (c: number): number => Math.min(255, Math.round(c + (255 - c) * factor))
  const toHex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`
}

export function computeAccentVariants(hex: string): {
  default: string
  hover: string
  muted: string
} {
  return {
    default: hex,
    hover: lightenHex(hex, 0.2),
    muted: hexToRgba(hex, 0.1)
  }
}

export function resolveColors(themeId: ThemeId, accentId: AccentColorId): ResolvedColors {
  const theme = THEMES[themeId]
  const accentHex = ACCENT_COLORS[accentId].value
  return {
    ...theme.colors,
    accent: computeAccentVariants(accentHex),
    semantic: { cluster: '#34D399', tension: '#F59E0B' }
  }
}

// ── Theme palettes ──────────────────────────────────────────────────────

export const THEMES = {
  midnight: {
    label: 'Midnight',
    colors: {
      bg: { base: '#080101', surface: '#0f0808', elevated: '#1a1111' },
      border: { default: 'rgba(255, 252, 252, 0.10)', subtle: 'rgba(255, 252, 252, 0.06)' },
      text: { primary: '#e8e6e6', secondary: '#7a7575', muted: '#4a4444' }
    }
  },
  slate: {
    label: 'Slate',
    colors: {
      bg: { base: '#0f172a', surface: '#1e293b', elevated: '#334155' },
      border: { default: '#475569', subtle: 'rgba(255, 255, 255, 0.08)' },
      text: { primary: '#f1f5f9', secondary: '#94a3b8', muted: '#64748b' }
    }
  },
  obsidian: {
    label: 'Obsidian',
    colors: {
      bg: { base: '#1e1e1e', surface: '#252525', elevated: '#2d2d2d' },
      border: { default: '#3e3e3e', subtle: 'rgba(255, 255, 255, 0.06)' },
      text: { primary: '#dcddde', secondary: '#999999', muted: '#666666' }
    }
  },
  nord: {
    label: 'Nord',
    colors: {
      bg: { base: '#2e3440', surface: '#3b4252', elevated: '#434c5e' },
      border: { default: '#4c566a', subtle: 'rgba(255, 255, 255, 0.08)' },
      text: { primary: '#eceff4', secondary: '#d8dee9', muted: '#7b88a1' }
    }
  },
  evergreen: {
    label: 'Evergreen',
    colors: {
      bg: { base: '#0c0c0e', surface: '#131315', elevated: '#1c1c1f' },
      border: { default: '#2a2a2d', subtle: 'rgba(255, 255, 255, 0.06)' },
      text: { primary: '#e6e8ec', secondary: '#8b8e96', muted: '#4a4c54' }
    }
  },
  light: {
    label: 'Light',
    colors: {
      bg: { base: '#ffffff', surface: '#f8fafc', elevated: '#f1f5f9' },
      border: { default: '#e2e8f0', subtle: 'rgba(0, 0, 0, 0.06)' },
      text: { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8' }
    }
  }
} as const satisfies Record<ThemeId, ThemeDefinition>

// ── Accent colors ───────────────────────────────────────────────────────

export const ACCENT_COLORS = {
  teal: { label: 'Teal', value: '#00e5bf' },
  blue: { label: 'Blue', value: '#3b82f6' },
  violet: { label: 'Violet', value: '#8b5cf6' },
  rose: { label: 'Rose', value: '#f43f5e' },
  amber: { label: 'Amber', value: '#f59e0b' },
  emerald: { label: 'Emerald', value: '#10b981' },
  cyan: { label: 'Cyan', value: '#06b6d4' },
  orange: { label: 'Orange', value: '#f97316' }
} as const satisfies Record<AccentColorId, AccentDefinition>

// ── Ordering for UI display ─────────────────────────────────────────────

export const THEME_ORDER = [
  'midnight',
  'slate',
  'obsidian',
  'nord',
  'evergreen',
  'light'
] as const satisfies readonly ThemeId[]

export const ACCENT_ORDER = [
  'teal',
  'blue',
  'violet',
  'rose',
  'amber',
  'emerald',
  'cyan',
  'orange'
] as const satisfies readonly AccentColorId[]
