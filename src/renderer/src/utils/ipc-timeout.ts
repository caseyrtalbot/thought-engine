/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within `ms`,
 * rejects with a descriptive TimeoutError.
 *
 * Use on critical IPC calls to prevent the renderer from hanging forever
 * if the main process deadlocks or a file operation stalls.
 */

export class IpcTimeoutError extends Error {
  constructor(context: string, ms: number) {
    super(`IPC timeout after ${ms}ms: ${context}`)
    this.name = 'IpcTimeoutError'
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new IpcTimeoutError(context, ms))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}
