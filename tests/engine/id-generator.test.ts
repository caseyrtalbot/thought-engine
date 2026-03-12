import { describe, it, expect } from 'vitest'
import { generateId, deriveCounters, type IdCounters } from '@engine/id-generator'

describe('generateId', () => {
  it('generates gene ID from counter', () => {
    const counters: IdCounters = { gene: 5 }
    const { id, updatedCounters } = generateId('gene', counters)
    expect(id).toBe('g6')
    expect(updatedCounters.gene).toBe(6)
  })

  it('starts from 1 when no counter exists', () => {
    const counters: IdCounters = {}
    const { id, updatedCounters } = generateId('constraint', counters)
    expect(id).toBe('c1')
    expect(updatedCounters.constraint).toBe(1)
  })

  it('uses correct prefix for each type', () => {
    expect(generateId('gene', {}).id).toMatch(/^g/)
    expect(generateId('constraint', {}).id).toMatch(/^c/)
    expect(generateId('research', {}).id).toMatch(/^r/)
    expect(generateId('output', {}).id).toMatch(/^o/)
    expect(generateId('note', {}).id).toMatch(/^n/)
    expect(generateId('index', {}).id).toMatch(/^i/)
  })

  it('does not mutate original counters', () => {
    const counters: IdCounters = { gene: 3 }
    generateId('gene', counters)
    expect(counters.gene).toBe(3)
  })
})

describe('deriveCounters', () => {
  it('derives counters from existing IDs', () => {
    const ids = ['g1', 'g5', 'g3', 'c2', 'r1']
    const counters = deriveCounters(ids)
    expect(counters.gene).toBe(5)
    expect(counters.constraint).toBe(2)
    expect(counters.research).toBe(1)
  })

  it('returns empty for no IDs', () => {
    expect(deriveCounters([])).toEqual({})
  })
})
