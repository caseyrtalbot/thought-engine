/**
 * Structured error logging for the renderer process.
 *
 * Two tiers:
 * - `logError`: console.error with structured context (for non-critical paths)
 * - `notifyError`: console.error + user-facing notification (for DATA paths)
 *
 * The notification callback can be replaced in tests or swapped for a toast system.
 */

type NotifyFn = (message: string) => void

let _notifyFn: NotifyFn = () => {}

/**
 * Register a callback that shows user-facing error notifications.
 * Call once at app init with your toast/status-bar handler.
 */
export function setErrorNotifier(fn: NotifyFn): void {
  _notifyFn = fn
}

/**
 * Log an error with structured context. Does not notify the user.
 * Use for non-critical paths where failure is acceptable but should be visible in dev tools.
 */
export function logError(context: string, err: unknown): void {
  console.error(`[${context}]`, err instanceof Error ? err.message : err)
}

/**
 * Log an error AND notify the user via the registered notifier.
 * Use for DATA paths where silent failure erodes trust (saves, persistence, file ops).
 */
export function notifyError(context: string, err: unknown, userMessage?: string): void {
  const detail = err instanceof Error ? err.message : String(err)
  console.error(`[${context}]`, detail)
  _notifyFn(userMessage ?? `${context}: ${detail}`)
}
