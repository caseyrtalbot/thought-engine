import { useEffect } from 'react'
import { useSettingsStore } from '../store/settings-store'
import { GOOGLE_FONTS, buildGoogleFontUrl, buildFontFamilyValue } from '../design/google-fonts'

function loadFont(name: string, linkId: string): void {
  if (name === 'System' || document.getElementById(linkId)) return
  const entry = GOOGLE_FONTS.find((f) => f.name === name)
  if (!entry) return
  const url = buildGoogleFontUrl(entry)
  if (!url) return

  const link = document.createElement('link')
  link.id = linkId
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

/**
 * Loads Google Fonts and applies CSS custom properties for the three font slots.
 * Reacts to settings changes so font swaps are instant.
 */
export function GoogleFontLoader() {
  const displayFont = useSettingsStore((s) => s.displayFont)
  const bodyFont = useSettingsStore((s) => s.bodyFont)
  const monoFont = useSettingsStore((s) => s.monoFont)

  useEffect(() => {
    loadFont(displayFont, `te-font-display-${displayFont.replace(/ /g, '-')}`)
    loadFont(bodyFont, `te-font-body-${bodyFont.replace(/ /g, '-')}`)
    loadFont(monoFont, `te-font-mono-${monoFont.replace(/ /g, '-')}`)

    const root = document.documentElement
    root.style.setProperty('--font-display', buildFontFamilyValue(displayFont))
    root.style.setProperty('--font-body', buildFontFamilyValue(bodyFont))
    root.style.setProperty('--font-mono', buildFontFamilyValue(monoFont))
  }, [displayFont, bodyFont, monoFont])

  return null
}
