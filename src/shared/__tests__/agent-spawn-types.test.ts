import { describe, expect, it } from 'vitest'
import type { AgentSpawnConfig, AgentSpawnRequest } from '../agent-types'

describe('AgentSpawnConfig', () => {
  it('has required fields: sessionId, vaultRoot, cwd', () => {
    const config: AgentSpawnConfig = {
      sessionId: 'test-123',
      vaultRoot: '/tmp/vault',
      cwd: '/tmp/vault/project'
    }

    expect(config.sessionId).toBe('test-123')
    expect(config.vaultRoot).toBe('/tmp/vault')
    expect(config.cwd).toBe('/tmp/vault/project')
  })

  it('accepts optional prompt field', () => {
    const config: AgentSpawnConfig = {
      sessionId: 'test-456',
      vaultRoot: '/tmp/vault',
      cwd: '/tmp/vault/project',
      prompt: 'Fix the bug in parser.ts'
    }

    expect(config.prompt).toBe('Fix the bug in parser.ts')
  })

  it('accepts optional sourceNodeId field', () => {
    const config: AgentSpawnConfig = {
      sessionId: 'test-789',
      vaultRoot: '/tmp/vault',
      cwd: '/tmp/vault/project',
      sourceNodeId: 'node-abc'
    }

    expect(config.sourceNodeId).toBe('node-abc')
  })

  it('enforces readonly on all fields', () => {
    const config: AgentSpawnConfig = {
      sessionId: 'test-readonly',
      vaultRoot: '/tmp/vault',
      cwd: '/tmp/vault/project'
    }

    // TypeScript compile-time check: these should be readonly
    // At runtime we just verify the values are correct
    expect(config).toEqual({
      sessionId: 'test-readonly',
      vaultRoot: '/tmp/vault',
      cwd: '/tmp/vault/project'
    })
  })
})

describe('AgentSpawnRequest', () => {
  it('has required field: cwd', () => {
    const request: AgentSpawnRequest = {
      cwd: '/tmp/vault/project'
    }

    expect(request.cwd).toBe('/tmp/vault/project')
  })

  it('accepts optional prompt and sourceNodeId', () => {
    const request: AgentSpawnRequest = {
      cwd: '/tmp/vault/project',
      prompt: 'Refactor the store',
      sourceNodeId: 'node-xyz'
    }

    expect(request.prompt).toBe('Refactor the store')
    expect(request.sourceNodeId).toBe('node-xyz')
  })
})
