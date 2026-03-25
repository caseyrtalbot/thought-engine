# Environment Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 6 hardcoded theme presets with 3 themes (Dark/Light/System) and expose 9 environment sliders for live workspace customization.

**Architecture:** Settings store gains an `env` object with slider values. ThemeProvider converts env numbers to CSS variables using theme-specific base colors. New Environment tab in SettingsModal renders grouped sliders with real-time preview. System theme reads `prefers-color-scheme`.

**Tech Stack:** React 18, TypeScript, Zustand (persist middleware), CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-25-environment-settings-design.md`

---

### Task 1: Rewrite themes.ts (data layer)

**Files:**
- Modify: `src/renderer/src/design/themes.ts`
- Test: `npx tsc --noEmit -p tsconfig.web.json`

Strip the 6-theme system to 2 structural themes + env defaults + base colors. Keep accent colors unchanged.

- [ ] **Step 1: Replace the entire themes.ts file**

```typescript
// src/renderer/src/design/themes.ts

export type ThemeId = 'dark' | 'light' | 'system'
export type ResolvedThemeId = 'dark' | 'light'

export type AccentColorId =
  | 'matrix' | 'laser' | 'synthwave' | 'hotpink'
  | 'arcade' | 'phosphor' | 'plasma' | 'neonmint'

// ── Environment settings shape ─────────────────────────────────────────

export interface EnvironmentSettings {
  readonly canvasTranslucency: number  // 0-100
  readonly cardOpacity: number         // 50-100
  readonly cardHeaderDarkness: number  // 0-60
  readonly cardBlur: number            // 0-24 (px)
  readonly gridDotVisibility: number   // 0-50
  readonly panelLightness: number      // 0-100 (HSL lightness %)
  readonly activityBarOpacity: number  // 20-80
  readonly cardTitleFontSize: number   // 10-15 (px)
  readonly sidebarFontSize: number     // 11-16 (px)
}

export const ENV_DEFAULTS: Record<ResolvedThemeId, EnvironmentSettings> = {
  dark: {
    canvasTranslucency: 40,
    cardOpacity: 94,
    cardHeaderDarkness: 45,
    cardBlur: 12,
    gridDotVisibility: 20,
    panelLightness: 5,
    activityBarOpacity: 55,
    cardTitleFontSize: 12,
    sidebarFontSize: 13
  },
  light: {
    canvasTranslucency: 45,
    cardOpacity: 90,
    cardHeaderDarkness: 4,
    cardBlur: 8,
    gridDotVisibility: 15,
    panelLightness: 98,
    activityBarOpacity: 12,
    cardTitleFontSize: 12,
    sidebarFontSize: 13
  }
}

// ── Base RGB values for rgba() conversions ─────────────────────────────

export interface BaseRgb { readonly r: number; readonly g: number; readonly b: number }

export interface ThemeBaseColors {
  readonly canvasSurface: BaseRgb
  readonly cardBody: BaseRgb
}

export const BASE_COLORS: Record<ResolvedThemeId, ThemeBaseColors> = {
  dark: {
    canvasSurface: { r: 18, g: 18, b: 20 },
    cardBody: { r: 16, g: 16, b: 20 }
  },
  light: {
    canvasSurface: { r: 232, g: 236, b: 240 },
    cardBody: { r: 255, g: 255, b: 255 }
  }
}

// ── Structural theme colors (non-env, set by theme choice) ─────────────

export interface StructuralColors {
  readonly border: { readonly default: string; readonly subtle: string }
  readonly text: { readonly primary: string; readonly secondary: string; readonly muted: string }
  readonly canvas: {
    readonly cardBorder: string
    readonly textHeading: string
    readonly blockquoteBar: string
  }
}

export const STRUCTURAL_COLORS: Record<ResolvedThemeId, StructuralColors> = {
  dark: {
    border: {
      default: 'color-mix(in srgb, white 8%, transparent)',
      subtle: 'color-mix(in srgb, white 4%, transparent)'
    },
    text: { primary: '#d9d9d9', secondary: '#808080', muted: '#525252' },
    canvas: {
      cardBorder: 'rgba(255, 255, 255, 0.06)',
      textHeading: '#e8e8e8',
      blockquoteBar: '#4a4a4a'
    }
  },
  light: {
    border: {
      default: '#e2e8f0',
      subtle: 'color-mix(in srgb, black 6%, transparent)'
    },
    text: { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8' },
    canvas: {
      cardBorder: 'rgba(0, 0, 0, 0.06)',
      textHeading: '#0f172a',
      blockquoteBar: '#cbd5e1'
    }
  }
}

// ── Accent colors (unchanged) ──────────────────────────────────────────

interface AccentDefinition { readonly label: string; readonly value: string }

function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ]
}

function lightenHex(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex)
  const lighten = (c: number): number => Math.min(255, Math.round(c + (255 - c) * factor))
  const toHex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`
}

export function computeAccentVariants(hex: string): {
  default: string; hover: string; muted: string
} {
  return {
    default: hex,
    hover: lightenHex(hex, 0.2),
    muted: `color-mix(in srgb, ${hex} 10%, transparent)`
  }
}

export const ACCENT_COLORS: Record<AccentColorId, AccentDefinition> = {
  matrix: { label: 'Matrix', value: '#39ff14' },
  laser: { label: 'Laser', value: '#ff3131' },
  synthwave: { label: 'Synthwave', value: '#b026ff' },
  hotpink: { label: 'Hot Pink', value: '#ff10f0' },
  arcade: { label: 'Arcade', value: '#ffff33' },
  phosphor: { label: 'Phosphor', value: '#00ff87' },
  plasma: { label: 'Plasma', value: '#00d4ff' },
  neonmint: { label: 'Neon Mint', value: '#00ffcc' }
}

export const ACCENT_ORDER: readonly AccentColorId[] = [
  'matrix', 'laser', 'synthwave', 'hotpink',
  'arcade', 'phosphor', 'plasma', 'neonmint'
]
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: Errors in files that import old types (`ResolvedColors`, `THEMES`, `THEME_ORDER`, `resolveColors`). This is expected -- we fix consumers in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/design/themes.ts
git commit -m "refactor: strip themes.ts to dark/light + env defaults + base colors"
```

---

### Task 2: Update settings-store.ts

**Files:**
- Modify: `src/renderer/src/store/settings-store.ts`

Add `env` object, `setEnv`/`resetEnv` actions, migrate from v2 to v3.

- [ ] **Step 1: Rewrite settings-store.ts**

```typescript
// src/renderer/src/store/settings-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  ACCENT_COLORS,
  ENV_DEFAULTS,
  type ThemeId,
  type ResolvedThemeId,
  type AccentColorId,
  type EnvironmentSettings
} from '../design/themes'

/** Resolve 'system' to 'dark' or 'light' based on OS preference. */
export function resolveTheme(theme: ThemeId): ResolvedThemeId {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

interface SettingsState {
  readonly theme: ThemeId
  readonly accentColor: AccentColorId
  readonly env: EnvironmentSettings
  readonly defaultEditorMode: 'rich' | 'source'
  readonly autosaveInterval: number
  readonly spellCheck: boolean
  readonly terminalShell: string
  readonly terminalFontSize: number
  readonly scrollbackLines: number
}

interface SettingsActions {
  setTheme: (value: ThemeId) => void
  setAccentColor: (value: AccentColorId) => void
  setEnv: <K extends keyof EnvironmentSettings>(key: K, value: EnvironmentSettings[K]) => void
  resetEnv: () => void
  setDefaultEditorMode: (value: 'rich' | 'source') => void
  setAutosaveInterval: (value: number) => void
  setSpellCheck: (value: boolean) => void
  setTerminalShell: (value: string) => void
  setTerminalFontSize: (value: number) => void
  setScrollbackLines: (value: number) => void
}

type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      accentColor: 'matrix',
      env: { ...ENV_DEFAULTS.dark },
      defaultEditorMode: 'rich',
      autosaveInterval: 1500,
      spellCheck: false,
      terminalShell: '',
      terminalFontSize: 13,
      scrollbackLines: 10000,

      // Resets env to theme defaults on EVERY explicit theme switch,
      // including re-clicking the current theme. This is intentional:
      // it gives users a quick "reset to defaults" path.
      setTheme: (value) => {
        const resolved = resolveTheme(value)
        set({ theme: value, env: { ...ENV_DEFAULTS[resolved] } })
      },
      setAccentColor: (value) => set({ accentColor: value }),
      setEnv: (key, value) =>
        set((state) => ({ env: { ...state.env, [key]: value } })),
      resetEnv: () => {
        const resolved = resolveTheme(get().theme)
        set({ env: { ...ENV_DEFAULTS[resolved] } })
      },
      setDefaultEditorMode: (value) => set({ defaultEditorMode: value }),
      setAutosaveInterval: (value) => set({ autosaveInterval: value }),
      setSpellCheck: (value) => set({ spellCheck: value }),
      setTerminalShell: (value) => set({ terminalShell: value }),
      setTerminalFontSize: (value) => set({ terminalFontSize: value }),
      setScrollbackLines: (value) => set({ scrollbackLines: value })
    }),
    {
      name: 'machina-settings',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>

        if (version < 3) {
          // Map old theme IDs to dark/light
          const oldTheme = state.theme as string
          const isLight = oldTheme === 'light'
          state.theme = isLight ? 'light' : 'dark'

          // Initialize env from resolved theme defaults
          const defaults = isLight ? ENV_DEFAULTS.light : ENV_DEFAULTS.dark
          const oldFontSize = (state.fontSize as number | undefined) ?? 13
          state.env = { ...defaults, sidebarFontSize: oldFontSize }

          // Clean up old fields
          delete state.fontSize
          delete state.fontFamily
        }

        // Validate accent color
        const accent = state.accentColor as string | undefined
        if (accent && !(accent in ACCENT_COLORS)) {
          state.accentColor = 'matrix'
        }

        return state as unknown as SettingsState & SettingsActions
      }
    }
  )
)
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: More errors from consumers of removed `fontSize`/`setFontSize`/`fontFamily`/`setFontFamily`. Expected at this stage.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/store/settings-store.ts
git commit -m "refactor: settings store v3 with env sliders and theme migration"
```

---

### Task 3: Rewrite Theme.tsx (conversion engine)

**Files:**
- Modify: `src/renderer/src/design/Theme.tsx`

ThemeProvider becomes the conversion engine: reads env values, computes CSS vars, exports env via context.

- [ ] **Step 1: Rewrite Theme.tsx**

```typescript
// src/renderer/src/design/Theme.tsx
import { createContext, useContext, useLayoutEffect, useMemo, useEffect, useState, type ReactNode } from 'react'
import { spacing, typography, transitions } from './tokens'
import {
  STRUCTURAL_COLORS,
  BASE_COLORS,
  computeAccentVariants,
  ACCENT_COLORS,
  type ResolvedThemeId,
  type EnvironmentSettings
} from './themes'
import { useSettingsStore, resolveTheme } from '../store/settings-store'

interface EnvContext {
  readonly cardBlur: number
  readonly gridDotVisibility: number
  readonly activityBarOpacity: number
  readonly cardTitleFontSize: number
  readonly sidebarFontSize: number
  readonly resolvedTheme: ResolvedThemeId
}

interface ThemeContextType {
  spacing: typeof spacing
  typography: typeof typography
  transitions: typeof transitions
  env: EnvContext
}

const ThemeContext = createContext<ThemeContextType>({
  spacing,
  typography,
  transitions,
  env: {
    cardBlur: 12,
    gridDotVisibility: 20,
    activityBarOpacity: 55,
    cardTitleFontSize: 12,
    sidebarFontSize: 13,
    resolvedTheme: 'dark'
  }
})

function useResolvedTheme(): ResolvedThemeId {
  const theme = useSettingsStore((s) => s.theme)
  const [resolved, setResolved] = useState<ResolvedThemeId>(() => resolveTheme(theme))

  useEffect(() => {
    if (theme !== 'system') {
      setResolved(theme)
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light')
    setResolved(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return resolved
}

function applyEnvCssVars(resolved: ResolvedThemeId, env: EnvironmentSettings): void {
  const root = document.documentElement
  const base = BASE_COLORS[resolved]
  const structural = STRUCTURAL_COLORS[resolved]

  // Env-derived vars
  const surfaceOpacity = (100 - env.canvasTranslucency) / 100
  root.style.setProperty(
    '--canvas-surface-bg',
    `rgba(${base.canvasSurface.r}, ${base.canvasSurface.g}, ${base.canvasSurface.b}, ${surfaceOpacity})`
  )

  const cardOp = env.cardOpacity / 100
  root.style.setProperty(
    '--canvas-card-bg',
    `rgba(${base.cardBody.r}, ${base.cardBody.g}, ${base.cardBody.b}, ${cardOp})`
  )

  root.style.setProperty(
    '--canvas-card-title-bg',
    `rgba(0, 0, 0, ${env.cardHeaderDarkness / 100})`
  )

  // Panel lightness -> bg base/surface/elevated
  const l = env.panelLightness
  root.style.setProperty('--color-bg-base', `hsl(0, 0%, ${l}%)`)
  root.style.setProperty('--color-bg-surface', `hsl(0, 0%, ${Math.min(l + 7, 100)}%)`)
  root.style.setProperty('--color-bg-elevated', `hsl(0, 0%, ${Math.min(l + 13, 100)}%)`)

  // Structural vars (not env-controlled)
  root.style.setProperty('--color-border-default', structural.border.default)
  root.style.setProperty('--border-subtle', structural.border.subtle)
  root.style.setProperty('--color-text-primary', structural.text.primary)
  root.style.setProperty('--color-text-secondary', structural.text.secondary)
  root.style.setProperty('--color-text-muted', structural.text.muted)
  root.style.setProperty('--canvas-card-border', structural.canvas.cardBorder)
  root.style.setProperty('--canvas-text-heading', structural.canvas.textHeading)
  root.style.setProperty('--canvas-blockquote-bar', structural.canvas.blockquoteBar)
}

function applyAccentCssVars(accentHex: string): void {
  const root = document.documentElement
  const accent = computeAccentVariants(accentHex)
  root.style.setProperty('--color-accent-default', accent.default)
  root.style.setProperty('--color-accent-hover', accent.hover)
  root.style.setProperty('--color-accent-muted', accent.muted)

  if (accentHex.startsWith('#') && accentHex.length === 7) {
    const r = parseInt(accentHex.slice(1, 3), 16)
    const g = parseInt(accentHex.slice(3, 5), 16)
    const b = parseInt(accentHex.slice(5, 7), 16)
    root.style.setProperty('--neon-glow', `0 0 8px rgba(${r}, ${g}, ${b}, 0.15)`)
    root.style.setProperty('--color-accent-focus', `rgba(${r}, ${g}, ${b}, 0.3)`)
    root.style.setProperty('--color-accent-subtle', `rgba(${r}, ${g}, ${b}, 0.15)`)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const resolved = useResolvedTheme()
  const accentColor = useSettingsStore((s) => s.accentColor)
  const env = useSettingsStore((s) => s.env)

  const accentHex = ACCENT_COLORS[accentColor].value

  useLayoutEffect(() => {
    applyEnvCssVars(resolved, env)
  }, [resolved, env])

  useLayoutEffect(() => {
    applyAccentCssVars(accentHex)
  }, [accentHex])

  const ctx = useMemo<ThemeContextType>(
    () => ({
      spacing,
      typography,
      transitions,
      env: {
        cardBlur: env.cardBlur,
        gridDotVisibility: env.gridDotVisibility,
        activityBarOpacity: env.activityBarOpacity,
        cardTitleFontSize: env.cardTitleFontSize,
        sidebarFontSize: env.sidebarFontSize,
        resolvedTheme: resolved
      }
    }),
    [env, resolved]
  )

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextType {
  return useContext(ThemeContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEnv(): EnvContext {
  return useContext(ThemeContext).env
}
```

**Key changes from old Theme.tsx:**
- Removes `useColors()` export. Consumers should use `colors` from `tokens.ts` (references CSS vars) or `useEnv()` for direct env values.
- `computeAccentVariants` is now exported from themes.ts (was private). This is deliberate: ThemeProvider needs it.
- `semantic` colors (`cluster`, `tension`) are preserved via the static `colors.semantic` object in `tokens.ts`, not via ThemeContext. No consumer changes needed for semantics.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: Errors from consumers of old `useColors()`. Fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/design/Theme.tsx
git commit -m "refactor: ThemeProvider as env conversion engine with prefers-color-scheme"
```

---

### Task 4: Update index.css

**Files:**
- Modify: `src/renderer/src/assets/index.css`

Simplify the `:root` CSS variable defaults. ThemeProvider sets env-derived vars on mount, but we keep dark-theme defaults as FOUC (flash of unstyled content) fallbacks so the app looks correct during the brief window between CSS load and React mount.

- [ ] **Step 1: Replace the canvas/panel CSS var block in :root**

Replace the canvas defaults block (lines ~100-127) and the panel color vars with dark-theme defaults that match `ENV_DEFAULTS.dark`. These serve as FOUC fallbacks only. ThemeProvider overrides them immediately on mount.

Keep these as fallbacks:
```css
  --color-bg-base: hsl(0, 0%, 5%);
  --color-bg-surface: hsl(0, 0%, 12%);
  --color-bg-elevated: hsl(0, 0%, 18%);
  --canvas-surface-bg: rgba(18, 18, 20, 0.60);
  --canvas-card-bg: rgba(16, 16, 20, 0.94);
  --canvas-card-title-bg: rgba(0, 0, 0, 0.45);
```

Remove these (moved to ThemeProvider):
```css
  --canvas-card-border: ...   (now in STRUCTURAL_COLORS)
  --canvas-text-heading: ...  (now in STRUCTURAL_COLORS)
  --canvas-blockquote-bar: ... (now in STRUCTURAL_COLORS)
```

Keep `--canvas-link-cyan: #5cb8c4` (not env-controlled, not in ThemeProvider).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/assets/index.css
git commit -m "refactor: remove hardcoded canvas CSS vars, now set by ThemeProvider"
```

---

### Task 5: Fix consumer compilation errors

**Files:**
- Modify: `src/renderer/src/components/SettingsModal.tsx`
- Modify: `src/renderer/src/components/ActivityBar.tsx`
- Modify: `src/renderer/src/components/GoogleFontLoader.tsx`
- Modify: `src/renderer/src/panels/canvas/CardShell.tsx`
- Modify: `src/renderer/src/panels/canvas/CanvasSurface.tsx`
- Modify: `src/renderer/src/panels/sidebar/FileTree.tsx`
- Modify: All other files that import `useColors`, `THEMES`, `THEME_ORDER`, `resolveColors`, `fontSize`/`setFontSize`/`fontFamily`/`setFontFamily`

This task fixes all compilation errors from Tasks 1-4. The `fontFamily` feature is being intentionally removed (simplifying to a fixed font stack). GoogleFontLoader, FontPicker, and google-fonts.ts all need cleanup.

- [ ] **Step 1: Find all broken imports**

Run: `npx tsc --noEmit -p tsconfig.web.json 2>&1 | head -80`

Identify every file with errors. Common patterns:
- `useColors` no longer exists -> replace with `colors` import from `tokens.ts` (already references CSS vars) or `useEnv` from `Theme.tsx`
- `THEMES`, `THEME_ORDER`, `resolveColors`, `ResolvedColors` no longer exist -> remove imports
- `fontSize`/`setFontSize`/`fontFamily`/`setFontFamily` removed from settings store -> use `env.sidebarFontSize` via `setEnv`

- [ ] **Step 2: Simplify GoogleFontLoader.tsx**

Remove the dynamic font family loading. Keep only fixed font loading (JetBrains Mono + Inter). Remove `fontSize` and `fontFamily` reads from the settings store. The body font is now always Inter, body font size is handled by CSS.

```typescript
// Simplified: just load the two fixed Google Fonts on mount
export function GoogleFontLoader() {
  useEffect(() => {
    // Load JetBrains Mono (terminals, code) and Inter (body)
    for (const [id, url] of [['te-mono-font', MONO_FONT_URL], ['te-body-font', BODY_FONT_URL]]) {
      if (!document.getElementById(id)) {
        const link = document.createElement('link')
        link.id = id
        link.rel = 'stylesheet'
        link.href = url
        document.head.appendChild(link)
      }
    }
  }, [])
  return null
}
```

- [ ] **Step 3: Remove FontPicker component and clean up google-fonts.ts**

`FontPicker.tsx` is no longer used (font family setting removed). Delete it or leave it dead. Remove `FontPicker` import from SettingsModal.

In `FileTree.tsx`: replace `useSettingsStore((s) => s.fontFamily)` and `buildFontFamilyValue(settingsFontFamily)` with a fixed font family string. Replace `useSettingsStore((s) => s.fontSize)` with `useSettingsStore((s) => s.env.sidebarFontSize)`.

- [ ] **Step 4: Fix all remaining broken files**

For each broken file:
1. Replace `useColors()` with `colors` import from `../../design/tokens`
2. Replace `useSettingsStore((s) => s.fontSize)` with `useSettingsStore((s) => s.env.sidebarFontSize)`
3. Remove any `fontFamily`/`buildFontFamilyValue` references (use `'inherit'` or the fixed CSS font stack)
4. ActivityBar, CardShell, CanvasSurface env wiring happens in Task 7 (not here)

- [ ] **Step 3: Typecheck must pass clean**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: ZERO errors

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass (877+)

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "refactor: fix all consumer imports for new theme/env system"
```

---

### Task 6: Build the Environment tab in SettingsModal

**Files:**
- Modify: `src/renderer/src/components/SettingsModal.tsx`

Replace the 6-theme grid with 3-theme selector. Add Environment tab with grouped sliders.

- [ ] **Step 1: Rewrite AppearanceTab**

Replace the `AppearanceTab` function with:
- 3 theme buttons (Dark / Light / System) in a horizontal row
- Accent color swatches (unchanged)
- Remove font family picker (removed from store)
- Remove font size slider (moved to Environment tab)

- [ ] **Step 2: Add EnvironmentTab**

New function `EnvironmentTab` with three sections:

**Canvas section:** 5 sliders (canvasTranslucency, cardOpacity, cardHeaderDarkness, cardBlur, gridDotVisibility)
**Panels section:** 2 sliders (panelLightness, activityBarOpacity)
**Typography section:** 2 sliders (cardTitleFontSize, sidebarFontSize)

Each slider uses the existing `SliderInput` component. Each reads from `useSettingsStore((s) => s.env.KEY)` and writes via `useSettingsStore((s) => s.setEnv)('KEY', value)`.

Add a "Reset to Defaults" button at the bottom that calls `resetEnv()`.

- [ ] **Step 3: Update tab list**

```typescript
const TABS: { id: TabId; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'environment', label: 'Environment' },
  { id: 'editor', label: 'Editor' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'vault', label: 'Vault' }
]
```

Add `'environment'` to the `TabId` type.

- [ ] **Step 4: Typecheck + visual verify**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Open the app, open Settings, verify all tabs render, sliders work with live preview.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/SettingsModal.tsx
git commit -m "feat: environment tab with 9 live-preview sliders"
```

---

### Task 7: Wire direct consumers (ActivityBar, CardShell, CanvasSurface)

**Files:**
- Modify: `src/renderer/src/components/ActivityBar.tsx`
- Modify: `src/renderer/src/panels/canvas/CardShell.tsx`
- Modify: `src/renderer/src/panels/canvas/CanvasSurface.tsx`

These components read env values directly from ThemeContext (not CSS vars) because they need the raw numbers for inline styles or JS logic.

- [ ] **Step 1: ActivityBar - read activityBarOpacity from env**

Replace hardcoded `rgba(0, 0, 0, 0.55)` with:
```typescript
const { activityBarOpacity } = useEnv()
// ...
backgroundColor: `rgba(0, 0, 0, ${activityBarOpacity / 100})`
```

Import `useEnv` from `../../design/Theme`.

- [ ] **Step 2: CardShell - read cardBlur and cardTitleFontSize from env**

Replace hardcoded `blur(12px) saturate(1.2)` with:
```typescript
const { cardBlur, cardTitleFontSize } = useEnv()
// ...
backdropFilter: `blur(${cardBlur}px) saturate(1.2)`
// title bar text:
fontSize: cardTitleFontSize
```

- [ ] **Step 3: CanvasSurface - read gridDotVisibility from env**

Replace `const MINOR_OPACITY = 0.2` (line 20) with:
```typescript
const { gridDotVisibility } = useEnv()
const MINOR_OPACITY = gridDotVisibility / 100
```

Note: This must be inside the component function, not at module level. Move the opacity into the `computeGridParams` call or the `useMemo` that builds the SVG.

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit -p tsconfig.web.json && npm test`
Expected: Clean typecheck, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ActivityBar.tsx src/renderer/src/panels/canvas/CardShell.tsx src/renderer/src/panels/canvas/CanvasSurface.tsx
git commit -m "feat: wire env sliders to ActivityBar, CardShell, CanvasSurface"
```

---

### Task 8: Unit tests for theme logic

**Files:**
- Create: `tests/design/theme-env.test.ts`

Test the pure-logic functions that drive the theme system.

- [ ] **Step 1: Write tests for resolveTheme and migration**

```typescript
// tests/design/theme-env.test.ts
import { describe, it, expect, vi } from 'vitest'

// Test resolveTheme
describe('resolveTheme', () => {
  it('returns dark for dark', () => { /* ... */ })
  it('returns light for light', () => { /* ... */ })
  it('returns dark when system prefers dark', () => { /* mock matchMedia */ })
  it('returns light when system prefers light', () => { /* mock matchMedia */ })
})

// Test migration from v2 to v3
describe('settings migration v2 to v3', () => {
  it('maps midnight theme to dark', () => { /* ... */ })
  it('maps light theme to light', () => { /* ... */ })
  it('preserves fontSize as env.sidebarFontSize', () => { /* ... */ })
  it('defaults missing fontSize to 13', () => { /* ... */ })
  it('deletes old fontSize and fontFamily fields', () => { /* ... */ })
  it('resets invalid accent color to matrix', () => { /* ... */ })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: New tests pass alongside existing 877+ tests.

- [ ] **Step 3: Commit**

```bash
git add tests/design/theme-env.test.ts
git commit -m "test: unit tests for resolveTheme and settings migration v2->v3"
```

---

### Task 9: Full verification

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: Both tsconfig.node.json and tsconfig.web.json pass clean.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: 877+ tests pass.

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 4: Manual verification**

1. `npm run dev`
2. Open Settings (gear icon)
3. Verify 3 themes (Dark/Light/System) render as horizontal buttons
4. Switch to Light -> verify all sliders reset to light defaults
5. Switch to Dark -> verify all sliders reset to dark defaults
6. Go to Environment tab -> drag each slider, verify live preview
7. Close settings, reopen -> verify slider values persisted
8. Set System theme -> change macOS appearance -> verify theme switches live
9. Close and reopen app -> verify all settings persisted

- [ ] **Step 5: Commit any fixes, then final commit**

```bash
git add -A src/
git commit -m "feat: environment settings system complete"
```
