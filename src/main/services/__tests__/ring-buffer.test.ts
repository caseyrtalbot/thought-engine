// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { RingBuffer } from '../ring-buffer'

describe('RingBuffer', () => {
  it('returns empty snapshot from empty buffer', () => {
    const rb = new RingBuffer(16)

    const snap = rb.snapshot()

    expect(snap.length).toBe(0)
    expect(snap).toEqual(Buffer.alloc(0))
  })

  it('returns written data in snapshot for small write', () => {
    const rb = new RingBuffer(16)

    rb.write(Buffer.from('hello'))

    expect(rb.snapshot().toString()).toBe('hello')
  })

  it('returns all data when write exactly fills buffer', () => {
    const rb = new RingBuffer(8)
    const data = Buffer.from('12345678')

    rb.write(data)

    expect(rb.snapshot().toString()).toBe('12345678')
  })

  it('returns oldest-to-newest order after wraparound', () => {
    const rb = new RingBuffer(8)

    rb.write(Buffer.from('AAAAAA')) // 6 bytes, head at 6
    rb.write(Buffer.from('BBBB')) // 4 bytes, wraps: head at 2

    // 6 A's + 4 B's = 10 bytes into 8-byte buffer
    // Oldest 2 bytes overwritten, snapshot: AAAABBBB
    expect(rb.snapshot().toString()).toBe('AAAABBBB')
  })

  it('keeps only tail when data larger than capacity', () => {
    const rb = new RingBuffer(4)
    const big = Buffer.from('ABCDEFGH') // 8 bytes, capacity is 4

    rb.write(big)

    expect(rb.snapshot().toString()).toBe('EFGH')
    expect(rb.size).toBe(4)
  })

  it('concatenates multiple small writes correctly', () => {
    const rb = new RingBuffer(32)

    rb.write(Buffer.from('aaa'))
    rb.write(Buffer.from('bbb'))
    rb.write(Buffer.from('ccc'))

    expect(rb.snapshot().toString()).toBe('aaabbbccc')
  })

  it('resets to empty state on clear', () => {
    const rb = new RingBuffer(16)
    rb.write(Buffer.from('some data'))

    rb.clear()

    expect(rb.snapshot().length).toBe(0)
    expect(rb.size).toBe(0)
    expect(rb.bytesWritten).toBe(0)
  })

  it('tracks lifetime bytesWritten including overwritten data', () => {
    const rb = new RingBuffer(4)

    rb.write(Buffer.from('AAAA')) // 4 bytes
    rb.write(Buffer.from('BB')) // 2 more bytes, overwrites first 2

    expect(rb.bytesWritten).toBe(6)
  })

  it('caps size at capacity', () => {
    const rb = new RingBuffer(4)

    rb.write(Buffer.from('AA'))
    expect(rb.size).toBe(2)

    rb.write(Buffer.from('BBBB'))
    expect(rb.size).toBe(4) // capped, not 6
  })

  it('accepts string input', () => {
    const rb = new RingBuffer(32)

    rb.write('hello world')

    expect(rb.snapshot().toString()).toBe('hello world')
  })
})
