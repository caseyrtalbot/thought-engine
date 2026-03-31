import { describe, it, expect, beforeEach } from 'vitest'
import {
  processWorkerMessage,
  resetWorkerState
} from '../../src/renderer/src/workers/project-map-worker'

describe('project-map-worker', () => {
  let posted: unknown[]

  beforeEach(() => {
    posted = []
    resetWorkerState()
  })

  const postMessage = (msg: unknown) => {
    posted.push(msg)
  }

  it('start initializes operation', () => {
    processWorkerMessage(
      {
        type: 'start',
        operationId: 'op1',
        rootPath: '/project',
        options: { expandDepth: 2, maxNodes: 200 }
      },
      postMessage
    )
    expect(posted).toEqual([])
  })

  it('append-files posts progress', () => {
    processWorkerMessage(
      {
        type: 'start',
        operationId: 'op1',
        rootPath: '/project',
        options: { expandDepth: 2, maxNodes: 200 }
      },
      postMessage
    )
    processWorkerMessage(
      {
        type: 'append-files',
        operationId: 'op1',
        files: [{ path: '/project/app.ts', content: 'const x = 1' }]
      },
      postMessage
    )
    expect(posted.length).toBe(1)
    expect((posted[0] as { type: string }).type).toBe('progress')
    expect((posted[0] as { operationId: string }).operationId).toBe('op1')
  })

  it('ignores append-files with wrong operationId', () => {
    processWorkerMessage(
      {
        type: 'start',
        operationId: 'op1',
        rootPath: '/project',
        options: { expandDepth: 2, maxNodes: 200 }
      },
      postMessage
    )
    processWorkerMessage(
      {
        type: 'append-files',
        operationId: 'stale-op',
        files: [{ path: '/project/app.ts', content: '' }]
      },
      postMessage
    )
    expect(posted).toEqual([])
  })

  it('finalize produces result', () => {
    processWorkerMessage(
      {
        type: 'start',
        operationId: 'op1',
        rootPath: '/project',
        options: { expandDepth: 2, maxNodes: 200 }
      },
      postMessage
    )
    processWorkerMessage(
      {
        type: 'append-files',
        operationId: 'op1',
        files: [{ path: '/project/app.ts', content: '' }]
      },
      postMessage
    )
    posted = []
    processWorkerMessage({ type: 'finalize', operationId: 'op1', existingNodes: [] }, postMessage)
    expect(posted.length).toBe(1)
    const result = posted[0] as { type: string; snapshot: { nodes: unknown[] } }
    expect(result.type).toBe('result')
    expect(result.snapshot.nodes.length).toBeGreaterThan(0)
  })

  it('cancel clears state', () => {
    processWorkerMessage(
      {
        type: 'start',
        operationId: 'op1',
        rootPath: '/project',
        options: { expandDepth: 2, maxNodes: 200 }
      },
      postMessage
    )
    processWorkerMessage({ type: 'cancel', operationId: 'op1' }, postMessage)
    processWorkerMessage(
      {
        type: 'append-files',
        operationId: 'op1',
        files: [{ path: '/project/app.ts', content: '' }]
      },
      postMessage
    )
    expect(posted).toEqual([])
  })

  it('finalize with wrong operationId is ignored', () => {
    processWorkerMessage(
      {
        type: 'start',
        operationId: 'op1',
        rootPath: '/project',
        options: { expandDepth: 2, maxNodes: 200 }
      },
      postMessage
    )
    processWorkerMessage({ type: 'finalize', operationId: 'wrong', existingNodes: [] }, postMessage)
    expect(posted).toEqual([])
  })
})
