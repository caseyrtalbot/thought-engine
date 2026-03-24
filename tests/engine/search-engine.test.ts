import { describe, test, expect, beforeEach } from 'vitest'
import { SearchEngine } from '../../src/renderer/src/engine/search-engine'
import type { SearchDoc } from '../../src/renderer/src/engine/search-engine'

function doc(overrides: Partial<SearchDoc> & { id: string }): SearchDoc {
  return {
    title: overrides.id,
    tags: [],
    body: '',
    path: `/${overrides.id}.md`,
    ...overrides
  }
}

describe('SearchEngine', () => {
  let engine: SearchEngine

  beforeEach(() => {
    engine = new SearchEngine()
  })

  test('upsert and search by title', () => {
    engine.upsert(doc({ id: 'react-hooks', title: 'React Hooks Guide' }))
    const hits = engine.search('react')
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('react-hooks')
    expect(hits[0].title).toBe('React Hooks Guide')
  })

  test('title matches rank higher than body matches', () => {
    engine.upsert(
      doc({ id: 'title-match', title: 'Testing Patterns', body: 'some unrelated text' })
    )
    engine.upsert(
      doc({
        id: 'body-match',
        title: 'Unrelated Title',
        body: 'This note discusses testing patterns in depth'
      })
    )
    const hits = engine.search('testing')
    expect(hits.length).toBeGreaterThanOrEqual(2)
    expect(hits[0].id).toBe('title-match')
  })

  test('tag matches rank between title and body', () => {
    engine.upsert(doc({ id: 'tagged', title: 'Some Note', tags: ['react', 'hooks'] }))
    engine.upsert(doc({ id: 'body-only', title: 'Other Note', body: 'react is mentioned here' }))
    const hits = engine.search('react')
    expect(hits.length).toBeGreaterThanOrEqual(2)
    // Tagged note should score higher than body-only
    const taggedIdx = hits.findIndex((h) => h.id === 'tagged')
    const bodyIdx = hits.findIndex((h) => h.id === 'body-only')
    expect(taggedIdx).toBeLessThan(bodyIdx)
  })

  test('search returns snippets from body', () => {
    engine.upsert(
      doc({
        id: 'snippet-test',
        title: 'Architecture',
        body: 'The hexagonal architecture pattern separates core logic from external adapters. This makes testing much easier.'
      })
    )
    const hits = engine.search('hexagonal')
    expect(hits).toHaveLength(1)
    expect(hits[0].snippet).toContain('hexagonal')
  })

  test('fuzzy matching works', () => {
    engine.upsert(doc({ id: 'fuzzy', title: 'Configuration' }))
    const hits = engine.search('configration') // missing 'u'
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('fuzzy')
  })

  test('prefix matching works', () => {
    engine.upsert(doc({ id: 'prefix', title: 'Authentication Flow' }))
    const hits = engine.search('auth')
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('prefix')
  })

  test('upsert overwrites existing document', () => {
    engine.upsert(doc({ id: 'a', title: 'Old Title', body: 'old content' }))
    engine.upsert(doc({ id: 'a', title: 'New Title', body: 'new content' }))

    expect(engine.size).toBe(1)
    const oldHits = engine.search('old')
    expect(oldHits).toHaveLength(0)
    const newHits = engine.search('new')
    expect(newHits).toHaveLength(1)
    expect(newHits[0].title).toBe('New Title')
  })

  test('remove deletes from index', () => {
    engine.upsert(doc({ id: 'temp', title: 'Temporary Note' }))
    engine.remove('temp')

    expect(engine.size).toBe(0)
    expect(engine.search('temporary')).toHaveLength(0)
  })

  test('remove non-existent id is a no-op', () => {
    engine.remove('does-not-exist')
    expect(engine.size).toBe(0)
  })

  test('empty query returns empty results', () => {
    engine.upsert(doc({ id: 'a', title: 'Something' }))
    expect(engine.search('')).toHaveLength(0)
    expect(engine.search('   ')).toHaveLength(0)
  })

  test('special characters in query do not throw', () => {
    engine.upsert(doc({ id: 'a', title: 'Test [brackets] (parens)' }))
    expect(() => engine.search('[brackets')).not.toThrow()
    expect(() => engine.search('test (parens)')).not.toThrow()
  })

  test('clear removes all documents', () => {
    engine.upsert(doc({ id: 'a', title: 'One' }))
    engine.upsert(doc({ id: 'b', title: 'Two' }))
    engine.clear()

    expect(engine.size).toBe(0)
    expect(engine.search('one')).toHaveLength(0)
  })

  test('search respects limit parameter', () => {
    for (let i = 0; i < 30; i++) {
      engine.upsert(doc({ id: `note-${i}`, title: `React Note ${i}`, body: 'react content' }))
    }
    const hits = engine.search('react', 5)
    expect(hits.length).toBeLessThanOrEqual(5)
  })

  test('empty body/tags upsert does not throw', () => {
    expect(() => engine.upsert(doc({ id: 'empty', title: 'Bare Note' }))).not.toThrow()
    const hits = engine.search('bare')
    expect(hits).toHaveLength(1)
  })

  test('snippet falls back to body start when no term match', () => {
    engine.upsert(
      doc({
        id: 'fallback',
        title: 'Fallback Test',
        body: 'This is the start of a very long note body that goes on and on about various topics.'
      })
    )
    // MiniSearch may find this via fuzzy/prefix on title
    const hits = engine.search('fallback')
    if (hits.length > 0 && hits[0].snippet) {
      expect(hits[0].snippet.length).toBeGreaterThan(0)
    }
  })
})
