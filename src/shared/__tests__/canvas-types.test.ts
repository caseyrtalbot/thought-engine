import { describe, expect, it } from 'vitest'
import {
  CARD_TYPE_INFO,
  getDefaultMetadata,
  getDefaultSize,
  getMinSize,
  type CanvasNodeType
} from '../canvas-types'

const ALL_TYPES: CanvasNodeType[] = [
  'text',
  'note',
  'terminal',
  'code',
  'markdown',
  'image',
  'pdf',
  'claude-settings',
  'claude-agent',
  'claude-skill',
  'claude-rule',
  'claude-command',
  'claude-team',
  'claude-memory',
  'project-file',
  'system-artifact'
]

describe('canvas-types registration completeness', () => {
  it.each(ALL_TYPES)('"%s" has a min size', (type) => {
    const size = getMinSize(type)
    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
  })

  it.each(ALL_TYPES)('"%s" has a default size', (type) => {
    const size = getDefaultSize(type)
    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
  })

  it.each(ALL_TYPES)('"%s" has card type info', (type) => {
    const info = CARD_TYPE_INFO[type]
    expect(info.label).toBeTruthy()
    expect(info.icon).toBeTruthy()
    expect(info.category).toBeTruthy()
  })

  it.each(ALL_TYPES)('"%s" returns default metadata', (type) => {
    const meta = getDefaultMetadata(type)
    expect(typeof meta).toBe('object')
  })

  it('system-artifact default metadata has expected shape', () => {
    const meta = getDefaultMetadata('system-artifact')
    expect(meta).toMatchObject({
      artifactKind: 'session',
      artifactId: '',
      status: '',
      filePath: '',
      signal: 'untested',
      fileRefCount: 0,
      connections: [],
      tensionRefs: []
    })
  })
})
