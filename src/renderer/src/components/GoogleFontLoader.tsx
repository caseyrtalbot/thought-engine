import { useEffect } from 'react'
import { GOOGLE_FONTS, buildGoogleFontUrl } from '../design/google-fonts'

const MONO_FONT = GOOGLE_FONTS.find((f) => f.name === 'JetBrains Mono')!
const MONO_FONT_URL = buildGoogleFontUrl(MONO_FONT)!
const BODY_FONT = GOOGLE_FONTS.find((f) => f.name === 'Inter')!
const BODY_FONT_URL = buildGoogleFontUrl(BODY_FONT)!

/**
 * Injects Google Fonts <link> tags into <head>:
 * - JetBrains Mono (terminal, source editor, code blocks)
 * - Inter (body text)
 *
 * Mount this once at the app root.
 */
export function GoogleFontLoader() {
  useEffect(() => {
    if (!document.getElementById('te-mono-font')) {
      const link = document.createElement('link')
      link.id = 'te-mono-font'
      link.rel = 'stylesheet'
      link.href = MONO_FONT_URL
      document.head.appendChild(link)
    }
    if (!document.getElementById('te-body-font')) {
      const link = document.createElement('link')
      link.id = 'te-body-font'
      link.rel = 'stylesheet'
      link.href = BODY_FONT_URL
      document.head.appendChild(link)
    }
  }, [])

  return null
}
