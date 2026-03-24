import { describe, it, expect, vi } from 'vitest'
import { withTimeout, IpcTimeoutError } from '../../src/renderer/src/utils/ipc-timeout'

describe('withTimeout', () => {
  it('resolves when promise completes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000, 'test')
    expect(result).toBe('ok')
  })

  it('rejects with IpcTimeoutError when promise exceeds timeout', async () => {
    vi.useFakeTimers()
    const never = new Promise(() => {}) // never resolves
    const promise = withTimeout(never, 100, 'stalled-op')

    vi.advanceTimersByTime(100)

    await expect(promise).rejects.toThrow(IpcTimeoutError)
    await expect(promise).rejects.toThrow('IPC timeout after 100ms: stalled-op')

    vi.useRealTimers()
  })

  it('propagates the original error if promise rejects before timeout', async () => {
    const error = new Error('original')
    await expect(withTimeout(Promise.reject(error), 1000, 'test')).rejects.toThrow('original')
  })

  it('clears the timer when promise resolves', async () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')

    const promise = withTimeout(Promise.resolve(42), 5000, 'test')
    await promise

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
    vi.useRealTimers()
  })

  it('clears the timer when promise rejects', async () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')

    const promise = withTimeout(Promise.reject(new Error('fail')), 5000, 'test')
    await promise.catch(() => {})

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
    vi.useRealTimers()
  })
})
