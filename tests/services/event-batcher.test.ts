import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventBatcher, coalesceEvent } from '../../src/main/services/event-batcher'

describe('EventBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('batches multiple events into a single callback', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')
    batcher.enqueue('/b.ts', 'change')
    batcher.enqueue('/c.ts', 'unlink')

    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush).toHaveBeenCalledWith([
      { path: '/a.ts', event: 'add' },
      { path: '/b.ts', event: 'change' },
      { path: '/c.ts', event: 'unlink' }
    ])
  })

  test('does not fire until flush interval elapses', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')

    vi.advanceTimersByTime(30)
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(20)
    expect(onFlush).toHaveBeenCalledOnce()
  })

  test('resets timer on new events within the window', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')
    vi.advanceTimersByTime(30)

    batcher.enqueue('/b.ts', 'add')
    vi.advanceTimersByTime(30)

    // 60ms total, but second event reset the timer so not flushed yet
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(20)
    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toHaveLength(2)
  })

  test('flushes separate batches for events in different windows', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')
    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledOnce()

    batcher.enqueue('/b.ts', 'change')
    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledTimes(2)
    expect(onFlush.mock.calls[1][0]).toEqual([{ path: '/b.ts', event: 'change' }])
  })

  test('does not fire if no events are queued', () => {
    const onFlush = vi.fn()
    new EventBatcher(onFlush, 50)

    vi.advanceTimersByTime(200)
    expect(onFlush).not.toHaveBeenCalled()
  })

  test('stop() flushes pending events immediately', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')
    batcher.enqueue('/b.ts', 'change')
    batcher.stop()

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toHaveLength(2)
  })

  test('stop() does nothing if queue is empty', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.stop()
    expect(onFlush).not.toHaveBeenCalled()
  })

  test('deduplicates same-type events for the same path', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'change')
    batcher.enqueue('/a.ts', 'change')
    batcher.enqueue('/a.ts', 'change')

    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toEqual([{ path: '/a.ts', event: 'change' }])
  })

  test('coalesces add+change to add (file is still new)', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')
    batcher.enqueue('/a.ts', 'change')

    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toEqual([{ path: '/a.ts', event: 'add' }])
  })

  test('coalesces add+unlink to drop (net no-op)', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')
    batcher.enqueue('/a.ts', 'unlink')

    vi.advanceTimersByTime(50)

    // Event cancelled out, nothing to flush
    expect(onFlush).not.toHaveBeenCalled()
  })

  test('coalesces unlink+add to change (file recreated)', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'unlink')
    batcher.enqueue('/a.ts', 'add')

    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toEqual([{ path: '/a.ts', event: 'change' }])
  })

  test('coalesces change+unlink to unlink', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'change')
    batcher.enqueue('/a.ts', 'unlink')

    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toEqual([{ path: '/a.ts', event: 'unlink' }])
  })

  test('coalescing does not affect other paths in the batch', () => {
    const onFlush = vi.fn()
    const batcher = new EventBatcher(onFlush, 50)

    batcher.enqueue('/a.ts', 'add')
    batcher.enqueue('/b.ts', 'change')
    batcher.enqueue('/a.ts', 'unlink') // cancels /a.ts

    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toEqual([{ path: '/b.ts', event: 'change' }])
  })
})

describe('coalesceEvent', () => {
  test('same event returns itself', () => {
    expect(coalesceEvent('add', 'add')).toBe('add')
    expect(coalesceEvent('change', 'change')).toBe('change')
    expect(coalesceEvent('unlink', 'unlink')).toBe('unlink')
  })

  test('add+unlink = null (cancel)', () => {
    expect(coalesceEvent('add', 'unlink')).toBeNull()
  })

  test('add+change = add', () => {
    expect(coalesceEvent('add', 'change')).toBe('add')
  })

  test('unlink+add = change', () => {
    expect(coalesceEvent('unlink', 'add')).toBe('change')
  })

  test('change+unlink = unlink (fallthrough)', () => {
    expect(coalesceEvent('change', 'unlink')).toBe('unlink')
  })

  test('change+add = add (fallthrough)', () => {
    expect(coalesceEvent('change', 'add')).toBe('add')
  })

  test('unlink+change = change (fallthrough)', () => {
    expect(coalesceEvent('unlink', 'change')).toBe('change')
  })
})
