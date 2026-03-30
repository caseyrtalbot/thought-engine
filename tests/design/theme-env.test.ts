import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { ThemeProvider } from '../../src/renderer/src/design/Theme'
import { resolveTheme } from '../../src/renderer/src/store/settings-store'
import { useSettingsStore } from '../../src/renderer/src/store/settings-store'
import { ENV_DEFAULTS, type EnvironmentSettings } from '../../src/renderer/src/design/themes'

function stubMatchMedia(matches = false): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  )
}

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
    stubMatchMedia(true)

    expect(resolveTheme('system')).toBe('dark')
  })

  it('returns light when system prefers light', () => {
    stubMatchMedia(false)

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

describe('ThemeProvider environment CSS vars', () => {
  beforeEach(() => {
    stubMatchMedia(false)
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    useSettingsStore.setState({
      theme: 'light',
      accentColor: 'matrix',
      env: {
        ...ENV_DEFAULTS.light,
        activityBarOpacity: 34,
        sidebarFontSize: 15,
        cardBlur: 18,
        cardTitleFontSize: 14
      },
      displayFont: 'Inter',
      bodyFont: 'Inter',
      monoFont: 'JetBrains Mono',
      defaultEditorMode: 'rich',
      autosaveInterval: 1500,
      spellCheck: false,
      terminalShell: '',
      terminalFontSize: 13,
      scrollbackLines: 10000
    })
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('style')
  })

  it('applies shared environment variables for rail chrome and sidebar sizing', () => {
    render(createElement(ThemeProvider, null, createElement('div', null, 'themed')))

    const rootStyle = document.documentElement.style
    expect(rootStyle.getPropertyValue('--chrome-rail-bg')).toBe('rgba(232, 236, 240, 0.34)')
    expect(rootStyle.getPropertyValue('--env-card-blur')).toBe('18px')
    expect(rootStyle.getPropertyValue('--env-card-title-font-size')).toBe('14px')
    expect(rootStyle.getPropertyValue('--env-sidebar-font-size')).toBe('15px')
    expect(rootStyle.getPropertyValue('--env-sidebar-secondary-font-size')).toBe('14px')
    expect(rootStyle.getPropertyValue('--env-sidebar-tertiary-font-size')).toBe('12px')
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
