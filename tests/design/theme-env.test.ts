import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveTheme } from '../../src/renderer/src/store/settings-store'
import { ENV_DEFAULTS, type EnvironmentSettings } from '../../src/renderer/src/design/themes'

describe('resolveTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns dark for input dark', () => {
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('returns light for input light', () => {
    expect(resolveTheme('light')).toBe('light')
  })

  it('returns dark when system prefers dark', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    )

    expect(resolveTheme('system')).toBe('dark')
  })

  it('returns light when system prefers light', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    )

    expect(resolveTheme('system')).toBe('light')
  })
})

describe('ENV_DEFAULTS', () => {
  const allEnvKeys: readonly (keyof EnvironmentSettings)[] = [
    'canvasTranslucency',
    'cardOpacity',
    'cardHeaderDarkness',
    'cardBlur',
    'gridDotVisibility',
    'panelLightness',
    'activityBarOpacity',
    'cardTitleFontSize',
    'sidebarFontSize'
  ]

  it('dark defaults have panelLightness of 5', () => {
    expect(ENV_DEFAULTS.dark.panelLightness).toBe(5)
  })

  it('light defaults have panelLightness of 98', () => {
    expect(ENV_DEFAULTS.light.panelLightness).toBe(98)
  })

  it('all env keys are present in dark defaults', () => {
    for (const key of allEnvKeys) {
      expect(ENV_DEFAULTS.dark).toHaveProperty(key)
      expect(typeof ENV_DEFAULTS.dark[key]).toBe('number')
    }
  })

  it('all env keys are present in light defaults', () => {
    for (const key of allEnvKeys) {
      expect(ENV_DEFAULTS.light).toHaveProperty(key)
      expect(typeof ENV_DEFAULTS.light[key]).toBe('number')
    }
  })
})

describe('v2 to v3 migration logic', () => {
  // The migration is embedded in Zustand persist config, so we replicate
  // the mapping logic here to test it in isolation.
  function migrateThemeAndEnv(state: Record<string, unknown>): Record<string, unknown> {
    const result = { ...state }

    const oldTheme = result.theme as string
    const isLight = oldTheme === 'light'
    result.theme = isLight ? 'light' : 'dark'

    const defaults = isLight ? ENV_DEFAULTS.light : ENV_DEFAULTS.dark
    const oldFontSize = (result.fontSize as number | undefined) ?? 13
    result.env = { ...defaults, sidebarFontSize: oldFontSize }

    delete result.fontSize
    delete result.fontFamily

    return result
  }

  it('maps old theme midnight to dark', () => {
    const result = migrateThemeAndEnv({ theme: 'midnight' })
    expect(result.theme).toBe('dark')
  })

  it('maps old theme slate to dark', () => {
    const result = migrateThemeAndEnv({ theme: 'slate' })
    expect(result.theme).toBe('dark')
  })

  it('maps old theme light to light', () => {
    const result = migrateThemeAndEnv({ theme: 'light' })
    expect(result.theme).toBe('light')
  })

  it('preserves fontSize 15 as env.sidebarFontSize', () => {
    const result = migrateThemeAndEnv({ theme: 'midnight', fontSize: 15 })
    expect((result.env as EnvironmentSettings).sidebarFontSize).toBe(15)
  })

  it('defaults missing fontSize to 13 in env.sidebarFontSize', () => {
    const result = migrateThemeAndEnv({ theme: 'midnight' })
    expect((result.env as EnvironmentSettings).sidebarFontSize).toBe(13)
  })

  it('removes fontSize and fontFamily from migrated state', () => {
    const result = migrateThemeAndEnv({ theme: 'slate', fontSize: 14, fontFamily: 'Mono' })
    expect(result).not.toHaveProperty('fontSize')
    expect(result).not.toHaveProperty('fontFamily')
  })
})
