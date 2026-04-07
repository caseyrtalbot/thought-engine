import { describe, it, expect } from 'vitest'
import {
  inferPropertyType,
  convertValue
} from '../../../src/renderer/src/panels/editor/PropertyInputs'

describe('inferPropertyType', () => {
  it('infers boolean from boolean value', () => {
    expect(inferPropertyType('draft', true)).toBe('boolean')
    expect(inferPropertyType('anything', false)).toBe('boolean')
  })

  it('infers number from number value', () => {
    expect(inferPropertyType('order', 42)).toBe('number')
    expect(inferPropertyType('weight', 3.14)).toBe('number')
  })

  it('infers list from array value', () => {
    expect(inferPropertyType('tags', ['a', 'b'])).toBe('list')
    expect(inferPropertyType('aliases', [])).toBe('list')
  })

  it('infers date from date-like key names', () => {
    expect(inferPropertyType('created', '2026-04-06')).toBe('date')
    expect(inferPropertyType('modified', '2026-01-01')).toBe('date')
    expect(inferPropertyType('published', '')).toBe('date')
    expect(inferPropertyType('due', 'next week')).toBe('date')
  })

  it('infers date from ISO date string regardless of key', () => {
    expect(inferPropertyType('some_field', '2026-04-06')).toBe('date')
  })

  it('infers text for plain strings', () => {
    expect(inferPropertyType('title', 'My Note')).toBe('text')
    expect(inferPropertyType('author', 'Casey')).toBe('text')
  })

  it('infers text for empty string with non-date key', () => {
    expect(inferPropertyType('title', '')).toBe('text')
  })
})

describe('convertValue', () => {
  it('converts string to boolean', () => {
    expect(convertValue('true', 'boolean')).toBe(true)
    expect(convertValue('false', 'boolean')).toBe(false)
    expect(convertValue('anything', 'boolean')).toBe(false)
  })

  it('converts number to boolean', () => {
    expect(convertValue(1, 'boolean')).toBe(true)
    expect(convertValue(0, 'boolean')).toBe(false)
  })

  it('converts string to number', () => {
    expect(convertValue('42', 'number')).toBe(42)
    expect(convertValue('not-a-number', 'number')).toBe(0)
  })

  it('converts boolean to number', () => {
    expect(convertValue(true, 'number')).toBe(1)
    expect(convertValue(false, 'number')).toBe(0)
  })

  it('converts to text', () => {
    expect(convertValue(true, 'text')).toBe('true')
    expect(convertValue(42, 'text')).toBe('42')
    expect(convertValue(['a', 'b'], 'text')).toBe('a, b')
  })

  it('converts string to list', () => {
    expect(convertValue('a, b, c', 'list')).toEqual(['a', 'b', 'c'])
  })

  it('preserves array when converting to list', () => {
    expect(convertValue(['x', 'y'], 'list')).toEqual(['x', 'y'])
  })

  it('converts to date (passthrough as string)', () => {
    expect(convertValue('2026-04-06', 'date')).toBe('2026-04-06')
    expect(convertValue(42, 'date')).toBe('42')
  })
})
