import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../../../store/canvas-store'
import { useVaultStore } from '../../../store/vault-store'
import { CommandStack } from '../canvas-commands'
import { applyAgentResult } from '../agent-apply'
import type { CanvasMutationPlan } from '@shared/canvas-mutation-types'
import type { AgentArtifactDraft } from '@shared/agent-artifact-types'

const mockMaterialize = vi.fn()
const mockUnmaterialize = vi.fn()

;(window as unknown as Record<string, unknown>).api = {
  artifact: {
    materialize: mockMaterialize,
    unmaterialize: mockUnmaterialize
  }
} as never

function makePlanWithMaterialize(): CanvasMutationPlan {
  const draft: AgentArtifactDraft = {
    kind: 'compiled-article',
    title: 'Test Compile',
    body: 'content',
    origin: 'agent',
    sources: ['Source A']
  }
  return {
    id: 'plan_test',
    operationId: 'op_test',
    source: 'agent',
    ops: [
      {
        type: 'materialize-artifact',
        draft,
        placement: { x: 100, y: 100, width: 480, height: 320 },
        tempNodeId: 'temp_1'
      }
    ],
    summary: {
      addedNodes: 1,
      addedEdges: 0,
      movedNodes: 0,
      skippedFiles: 0,
      unresolvedRefs: 0
    }
  }
}

describe('applyAgentResult with materialize-artifact', () => {
  let commandStack: CommandStack

  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getInitialState())
    useVaultStore.setState({
      ...useVaultStore.getInitialState(),
      vaultPath: '/vault',
      config: {
        version: 1,
        fonts: { display: '', body: '', mono: '' },
        workspaces: [],
        createdAt: '',
        compile: { persistenceEnabled: true, outputDir: 'compiled/' }
      }
    })
    commandStack = new CommandStack()
    mockMaterialize.mockReset()
    mockUnmaterialize.mockReset()
    mockMaterialize.mockResolvedValue({
      vaultRelativePath: 'compiled/test-compile.md',
      absolutePath: '/vault/compiled/test-compile.md',
      artifactId: 'uuid-1'
    })
  })

  it('calls artifact.materialize for materialize-artifact ops', async () => {
    const plan = makePlanWithMaterialize()
    await applyAgentResult(plan, commandStack)

    expect(mockMaterialize).toHaveBeenCalledTimes(1)
    expect(mockMaterialize).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Compile' }),
      expect.any(String)
    )
  })

  it('adds a file-view card pointing at the materialized file', async () => {
    const plan = makePlanWithMaterialize()
    await applyAgentResult(plan, commandStack)

    const { nodes } = useCanvasStore.getState()
    const fileViewNode = nodes.find((n) => n.type === 'file-view')
    expect(fileViewNode).toBeDefined()
    expect(fileViewNode!.content).toBe('compiled/test-compile.md')
  })

  it('undo calls unmaterialize and restores canvas state', async () => {
    const plan = makePlanWithMaterialize()
    await applyAgentResult(plan, commandStack)

    const nodesAfterApply = useCanvasStore.getState().nodes.length
    expect(nodesAfterApply).toBeGreaterThan(0)

    await commandStack.undo()

    expect(mockUnmaterialize).toHaveBeenCalledWith(
      ['/vault/compiled/test-compile.md'],
      expect.any(String)
    )
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })

  it('skips materialization when persistence is disabled', async () => {
    useVaultStore.setState({
      ...useVaultStore.getState(),
      config: {
        ...useVaultStore.getState().config!,
        compile: { persistenceEnabled: false }
      }
    })

    const plan = makePlanWithMaterialize()
    await applyAgentResult(plan, commandStack)

    expect(mockMaterialize).not.toHaveBeenCalled()
    const { nodes } = useCanvasStore.getState()
    expect(nodes.length).toBeGreaterThan(0)
  })

  it('rolls back canvas if phase A fails mid-batch', async () => {
    mockMaterialize.mockRejectedValueOnce(new Error('disk full'))

    const plan = makePlanWithMaterialize()
    await expect(applyAgentResult(plan, commandStack)).rejects.toThrow('disk full')

    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })
})
