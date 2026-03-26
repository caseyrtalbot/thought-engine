/** Format millisecond duration into compact human string (e.g. "5m", "1h 30m"). */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60

  if (hours > 0) {
    return remainMinutes > 0 ? `${hours}h ${remainMinutes}m` : `${hours}h`
  }
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}
