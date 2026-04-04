/**
 * Fixed-size circular buffer for terminal scrollback.
 *
 * Captures raw PTY output byte-for-byte. On reconnect, the snapshot
 * replays escape sequences (including alternate-screen enter/exit)
 * in order, so xterm.js restores terminal state cleanly -- unlike
 * tmux capture-pane which flattens alternate-screen context.
 */

export const DEFAULT_RING_BUFFER_BYTES = 8 * 1024 * 1024 // 8 MB

export class RingBuffer {
  private readonly buf: Buffer
  private head = 0 // next write position
  private filled = 0 // bytes currently stored
  private total = 0 // lifetime bytes written

  constructor(private readonly capacity: number = DEFAULT_RING_BUFFER_BYTES) {
    this.buf = Buffer.alloc(capacity)
  }

  /** Append data to the ring, overwriting oldest bytes when full. */
  write(data: Buffer | string): void {
    const chunk = typeof data === 'string' ? Buffer.from(data) : data
    const len = chunk.length
    this.total += len

    if (len >= this.capacity) {
      // Data larger than buffer: keep only the tail
      chunk.copy(this.buf, 0, len - this.capacity, len)
      this.head = 0
      this.filled = this.capacity
      return
    }

    const spaceToEnd = this.capacity - this.head

    if (len <= spaceToEnd) {
      chunk.copy(this.buf, this.head)
    } else {
      // Wraparound: split write across boundary
      chunk.copy(this.buf, this.head, 0, spaceToEnd)
      chunk.copy(this.buf, 0, spaceToEnd)
    }

    this.head = (this.head + len) % this.capacity
    this.filled = Math.min(this.filled + len, this.capacity)
  }

  /** Return contents oldest-to-newest as a new Buffer. */
  snapshot(): Buffer {
    if (this.filled === 0) return Buffer.alloc(0)

    if (this.filled < this.capacity) {
      // Haven't wrapped yet: data starts at 0
      return Buffer.from(this.buf.subarray(0, this.filled))
    }

    // Wrapped: oldest data starts at head
    const result = Buffer.alloc(this.capacity)
    const tailLen = this.capacity - this.head
    this.buf.copy(result, 0, this.head, this.head + tailLen)
    this.buf.copy(result, tailLen, 0, this.head)
    return result
  }

  /** Reset the buffer to empty state. */
  clear(): void {
    this.head = 0
    this.filled = 0
    this.total = 0
  }

  /** Lifetime bytes written (including overwritten data). */
  get bytesWritten(): number {
    return this.total
  }

  /** Bytes currently stored in the buffer. */
  get size(): number {
    return this.filled
  }
}
