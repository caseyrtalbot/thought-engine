import MiniSearch from 'minisearch'

export interface SearchDoc {
  readonly id: string
  readonly title: string
  readonly tags: readonly string[]
  readonly body: string
  readonly path: string
}

export interface SearchHit {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly snippet: string
  readonly score: number
}

const SNIPPET_HALF = 60
const MAX_SNIPPET_LENGTH = 140

function extractSnippet(body: string, queryTerms: readonly string[]): string {
  if (!body) return ''
  const lower = body.toLowerCase()
  let bestIndex = -1

  for (const term of queryTerms) {
    const idx = lower.indexOf(term.toLowerCase())
    if (idx !== -1) {
      bestIndex = idx
      break
    }
  }

  if (bestIndex === -1) {
    return (
      body.slice(0, MAX_SNIPPET_LENGTH).trim() + (body.length > MAX_SNIPPET_LENGTH ? '...' : '')
    )
  }

  const start = Math.max(0, bestIndex - SNIPPET_HALF)
  const end = Math.min(body.length, bestIndex + SNIPPET_HALF)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < body.length ? '...' : ''
  return `${prefix}${body.slice(start, end).trim()}${suffix}`
}

export class SearchEngine {
  private index: MiniSearch
  private docs = new Map<string, SearchDoc>()

  constructor() {
    this.index = new MiniSearch({
      fields: ['title', 'tagsText', 'body'],
      storeFields: ['title', 'path'],
      searchOptions: {
        boost: { title: 10, tagsText: 5, body: 1 },
        prefix: true,
        fuzzy: 0.2
      }
    })
  }

  upsert(doc: SearchDoc): void {
    if (this.docs.has(doc.id)) {
      this.index.discard(doc.id)
    }
    const indexed = {
      id: doc.id,
      title: doc.title,
      tagsText: doc.tags.join(' '),
      body: doc.body,
      path: doc.path
    }
    this.index.add(indexed)
    this.docs.set(doc.id, doc)
  }

  remove(id: string): void {
    if (!this.docs.has(id)) return
    this.index.discard(id)
    this.docs.delete(id)
  }

  search(query: string, limit = 20): SearchHit[] {
    if (!query.trim()) return []
    const results = this.index.search(query)
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean)

    return results.slice(0, limit).map((result) => {
      const doc = this.docs.get(result.id)
      return {
        id: result.id,
        title: (doc?.title ?? result.title) as string,
        path: (doc?.path ?? result.path) as string,
        snippet: doc ? extractSnippet(doc.body, queryTerms) : '',
        score: result.score
      }
    })
  }

  clear(): void {
    this.index.removeAll()
    this.docs.clear()
  }

  get size(): number {
    return this.docs.size
  }
}
