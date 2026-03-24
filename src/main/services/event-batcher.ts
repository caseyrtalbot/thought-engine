export type FileEvent = 'add' | 'change' | 'unlink'

export interface BatchedEvent {
  readonly path: string
  readonly event: FileEvent
}

export type BatchFlushCallback = (events: BatchedEvent[]) => void

/**
 * Collapse rapid event sequences for the same path into a single net event.
 * Returns null when the events cancel out (e.g. add then unlink = no-op).
 */
export function coalesceEvent(existing: FileEvent, incoming: FileEvent): FileEvent | null {
  if (existing === incoming) return existing
  if (existing === 'add' && incoming === 'unlink') return null
  if (existing === 'add' && incoming === 'change') return 'add'
  if (existing === 'unlink' && incoming === 'add') return 'change'
  // change+unlink = unlink, change+add would be odd but treat as change
  return incoming
}

export class EventBatcher {
  private queue = new Map<string, FileEvent>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly onFlush: BatchFlushCallback
  private readonly intervalMs: number

  constructor(onFlush: BatchFlushCallback, intervalMs: number) {
    this.onFlush = onFlush
    this.intervalMs = intervalMs
  }

  enqueue(path: string, event: FileEvent): void {
    const existing = this.queue.get(path)
    if (existing === undefined) {
      this.queue.set(path, event)
    } else {
      const coalesced = coalesceEvent(existing, event)
      if (coalesced === null) {
        this.queue.delete(path)
      } else {
        this.queue.set(path, coalesced)
      }
    }
    this.scheduleFlush()
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.flush()
  }

  private scheduleFlush(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, this.intervalMs)
  }

  private flush(): void {
    if (this.queue.size === 0) return
    const events: BatchedEvent[] = Array.from(this.queue.entries()).map(([path, event]) => ({
      path,
      event
    }))
    this.queue.clear()
    this.onFlush(events)
  }
}
