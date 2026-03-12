const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2'
const loadedFonts = new Set<string>()

export function loadGoogleFont(family: string, weights: number[] = [400, 500, 600, 700]): void {
  if (loadedFonts.has(family)) return
  loadedFonts.add(family)

  const weightsParam = weights.join(';')
  const encoded = encodeURIComponent(family)
  const url = `${GOOGLE_FONTS_API}?family=${encoded}:wght@${weightsParam}&display=swap`

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

export function loadVaultFonts(config: { display: string; body: string; mono: string }): void {
  const unique = new Set([config.display, config.body, config.mono])
  for (const font of unique) {
    loadGoogleFont(font)
  }
}
