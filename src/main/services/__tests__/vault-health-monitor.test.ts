// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { mkdtemp, writeFile, rm, stat as realStat, access as realAccess } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock only stat and access in vault-health-monitor's fs/promises import.
// We use vi.mock with importOriginal so mkdtemp/writeFile/rm stay real.
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    stat: vi.fn(actual.stat),
    access: vi.fn(actual.access)
  }
})

import { stat as mockedStat, access as mockedAccess } from 'fs/promises'
import { FsErrorLog } from '../fs-error-log'
import { VaultWatcher } from '../vault-watcher'
import { VaultHealthMonitor } from '../vault-health-monitor'
import type { InfraHealth } from '@shared/engine/vault-health'

// ---------------------------------------------------------------------------
// FsErrorLog
// ---------------------------------------------------------------------------

describe('FsErrorLog', () => {
  it('push adds errors up to capacity', () => {
    const log = new FsErrorLog(32, () => false)

    for (let i = 0; i < 5; i++) {
      log.push(`/file-${i}.md`, `Error ${i}`)
    }

    const drained = log.drain()
    expect(drained).toHaveLength(5)
    expect(drained[0].path).toBe('/file-0.md')
    expect(drained[4].path).toBe('/file-4.md')
  })

  it('ring buffer drops oldest when full (size 32)', () => {
    const log = new FsErrorLog(32, () => false)

    for (let i = 0; i < 33; i++) {
      log.push(`/file-${i}.md`, `Error ${i}`)
    }

    const drained = log.drain()
    expect(drained).toHaveLength(32)
    // Oldest (index 0) should be dropped
    expect(drained[0].path).toBe('/file-1.md')
    expect(drained[31].path).toBe('/file-32.md')
  })

  it('drain clears the buffer', () => {
    const log = new FsErrorLog(32, () => false)

    log.push('/a.md', 'err')
    log.push('/b.md', 'err')
    log.push('/c.md', 'err')

    const first = log.drain()
    expect(first).toHaveLength(3)

    const second = log.drain()
    expect(second).toHaveLength(0)
  })

  it('suppresses errors matching pending writes', () => {
    const pendingPaths = new Set(['/pending.md'])
    const log = new FsErrorLog(32, (path) => pendingPaths.has(path))

    log.push('/pending.md', 'EEXIST: file exists')

    const drained = log.drain()
    expect(drained).toHaveLength(0)
  })

  it('does not suppress errors for non-pending paths', () => {
    const pendingPaths = new Set(['/pending.md'])
    const log = new FsErrorLog(32, (path) => pendingPaths.has(path))

    log.push('/other.md', 'ENOENT: no such file')

    const drained = log.drain()
    expect(drained).toHaveLength(1)
    expect(drained[0].path).toBe('/other.md')
  })
})

// ---------------------------------------------------------------------------
// VaultWatcher health snapshot
// ---------------------------------------------------------------------------

describe('VaultWatcher.getHealthSnapshot', () => {
  let tmpDir: string

  beforeEach(async () => {
    // Use real fs for these tests -- restore mocked stat/access to original
    ;(mockedStat as Mock).mockImplementation(realStat)
    ;(mockedAccess as Mock).mockImplementation(realAccess)
    tmpDir = await mkdtemp(join(tmpdir(), 'vw-health-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns ready=false before start', () => {
    const watcher = new VaultWatcher()

    const snap = watcher.getHealthSnapshot()

    expect(snap.ready).toBe(false)
    expect(snap.lastEventAt).toBe(0)
    expect(snap.lastError).toBeNull()
  })

  it('ready becomes true after chokidar ready event', async () => {
    const watcher = new VaultWatcher()

    await watcher.start(tmpDir, () => {})

    // Wait a bit for the ready event to fire
    await new Promise<void>((resolve) => {
      const check = () => {
        if (watcher.getHealthSnapshot().ready) {
          resolve()
        } else {
          setTimeout(check, 50)
        }
      }
      check()
    })

    const snap = watcher.getHealthSnapshot()
    expect(snap.ready).toBe(true)

    await watcher.stop()
  }, 10_000)

  it('lastEventAt updates on file events', async () => {
    const watcher = new VaultWatcher()

    await watcher.start(tmpDir, () => {})

    // Wait for ready
    await new Promise<void>((resolve) => {
      const check = () => {
        if (watcher.getHealthSnapshot().ready) resolve()
        else setTimeout(check, 50)
      }
      check()
    })

    const before = watcher.getHealthSnapshot().lastEventAt
    expect(before).toBe(0)

    // Create a file to trigger an event
    await writeFile(join(tmpDir, 'test.md'), 'hello')

    // Wait for lastEventAt to update
    await new Promise<void>((resolve) => {
      const check = () => {
        if (watcher.getHealthSnapshot().lastEventAt > 0) resolve()
        else setTimeout(check, 50)
      }
      check()
    })

    const after = watcher.getHealthSnapshot().lastEventAt
    expect(after).toBeGreaterThan(0)

    await watcher.stop()
  }, 10_000)

  it('stop resets all snapshot state', async () => {
    const watcher = new VaultWatcher()

    await watcher.start(tmpDir, () => {})

    // Wait for ready
    await new Promise<void>((resolve) => {
      const check = () => {
        if (watcher.getHealthSnapshot().ready) resolve()
        else setTimeout(check, 50)
      }
      check()
    })

    expect(watcher.getHealthSnapshot().ready).toBe(true)

    await watcher.stop()

    const snap = watcher.getHealthSnapshot()
    expect(snap.ready).toBe(false)
    expect(snap.lastEventAt).toBe(0)
    expect(snap.lastError).toBeNull()
  }, 10_000)
})

// ---------------------------------------------------------------------------
// VaultHealthMonitor
// ---------------------------------------------------------------------------

describe('VaultHealthMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(mockedStat as Mock).mockReset()
    ;(mockedAccess as Mock).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeStubs(overrides?: {
    ready?: boolean
    lastError?: { error: string; at: number } | null
    fsErrors?: Array<{ path: string; error: string; at: number }>
  }) {
    const opts = {
      ready: true,
      lastError: null,
      fsErrors: [] as Array<{ path: string; error: string; at: number }>,
      ...overrides
    }

    const watcher = {
      getHealthSnapshot: () => ({
        ready: opts.ready,
        lastEventAt: 0,
        lastError: opts.lastError
      })
    } as unknown as VaultWatcher

    const errorLog = {
      drain: () => {
        const snapshot = [...opts.fsErrors]
        opts.fsErrors.length = 0
        return snapshot
      }
    } as unknown as FsErrorLog

    return { watcher, errorLog, opts }
  }

  function mockFsHealthy(): void {
    ;(mockedStat as Mock).mockResolvedValue({ isDirectory: () => true })
    ;(mockedAccess as Mock).mockResolvedValue(undefined)
  }

  it('emits healthy InfraHealth when all checks pass', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    expect(reports.length).toBeGreaterThanOrEqual(1)
    const report = reports[0]
    expect(report.runs).toHaveLength(4)
    for (const run of report.runs) {
      expect(run.passed).toBe(true)
    }

    monitor.stop()
  })

  it('vault-reachable fails when stat throws', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []

    ;(mockedStat as Mock).mockRejectedValue(new Error('ENOENT: no such file'))
    ;(mockedAccess as Mock).mockResolvedValue(undefined)

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const vaultCheck = reports[0].runs.find((r) => r.checkId === 'vault-reachable')
    expect(vaultCheck?.passed).toBe(false)

    monitor.stop()
  })

  it('vault-reachable fails when TE_DIR not writable', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []

    ;(mockedStat as Mock).mockResolvedValue({ isDirectory: () => true })
    ;(mockedAccess as Mock).mockRejectedValue(new Error('EACCES: permission denied'))

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const vaultCheck = reports[0].runs.find((r) => r.checkId === 'vault-reachable')
    expect(vaultCheck?.passed).toBe(false)

    monitor.stop()
  })

  it('watcher-alive fails when not ready', async () => {
    const { watcher, errorLog } = makeStubs({ ready: false })
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const watcherCheck = reports[0].runs.find((r) => r.checkId === 'watcher-alive')
    expect(watcherCheck?.passed).toBe(false)

    monitor.stop()
  })

  it('watcher-alive fails when lastError is set', async () => {
    const { watcher, errorLog } = makeStubs({
      lastError: { error: 'EMFILE: too many open files', at: Date.now() }
    })
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const watcherCheck = reports[0].runs.find((r) => r.checkId === 'watcher-alive')
    expect(watcherCheck?.passed).toBe(false)

    monitor.stop()
  })

  it('worker-responsive passes when both timestamps are 0 (cold start)', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    // Do NOT call recordFileChange or recordWorkerHeartbeat
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const workerCheck = reports[0].runs.find((r) => r.checkId === 'worker-responsive')
    expect(workerCheck?.passed).toBe(true)

    monitor.stop()
  })

  it('worker-responsive fails when gap > 10s', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.recordFileChange() // sets lastFileChangeAt to now
    // lastWorkerHeartbeatAt stays at 0, so gap is huge
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const workerCheck = reports[0].runs.find((r) => r.checkId === 'worker-responsive')
    expect(workerCheck?.passed).toBe(false)

    monitor.stop()
  })

  it('recent-disk-errors passes when buffer is empty', async () => {
    const { watcher, errorLog } = makeStubs({ fsErrors: [] })
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const diskCheck = reports[0].runs.find((r) => r.checkId === 'recent-disk-errors')
    expect(diskCheck?.passed).toBe(true)

    monitor.stop()
  })

  it('recent-disk-errors fails when buffer has entries', async () => {
    const { watcher, errorLog } = makeStubs({
      fsErrors: [{ path: '/file.md', error: 'ENOSPC', at: Date.now() }]
    })
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    await vi.advanceTimersByTimeAsync(1)

    const diskCheck = reports[0].runs.find((r) => r.checkId === 'recent-disk-errors')
    expect(diskCheck?.passed).toBe(false)
    expect(diskCheck?.issues?.length).toBe(1)

    monitor.stop()
  })

  it('thrown error in tick does not kill monitor -- next tick still runs', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []

    // First call to stat throws, subsequent calls succeed
    let callCount = 0
    ;(mockedStat as Mock).mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('Transient failure')
      return { isDirectory: () => true }
    })
    ;(mockedAccess as Mock).mockResolvedValue(undefined)

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.start('/fake/vault')

    // First tick (immediate) - will hit the error in vault-reachable
    await vi.advanceTimersByTimeAsync(1)
    expect(reports.length).toBeGreaterThanOrEqual(1)

    // Advance to next interval tick (30s)
    await vi.advanceTimersByTimeAsync(30_000)

    // Should have gotten a second report
    expect(reports.length).toBeGreaterThanOrEqual(2)

    monitor.stop()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('VaultHealthMonitor edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(mockedStat as Mock).mockReset()
    ;(mockedAccess as Mock).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeStubs() {
    const watcher = {
      getHealthSnapshot: () => ({
        ready: true,
        lastEventAt: 0,
        lastError: null
      })
    } as unknown as VaultWatcher

    const errorLog = {
      drain: () => []
    } as unknown as FsErrorLog

    return { watcher, errorLog }
  }

  function mockFsHealthy(): void {
    ;(mockedStat as Mock).mockResolvedValue({ isDirectory: () => true })
    ;(mockedAccess as Mock).mockResolvedValue(undefined)
  }

  it('vault switch resets timestamps atomically', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    monitor.recordFileChange()
    monitor.recordWorkerHeartbeat(Date.now())

    // Switch vault should reset both timestamps
    monitor.switchVault('/new/vault')

    monitor.start('/new/vault')
    await vi.advanceTimersByTimeAsync(1)

    // worker-responsive should pass because both timestamps reset to 0 (cold start)
    const workerCheck = reports[0].runs.find((r) => r.checkId === 'worker-responsive')
    expect(workerCheck?.passed).toBe(true)

    monitor.stop()
  })

  it('cold start: worker-responsive passes when no file events yet', async () => {
    const { watcher, errorLog } = makeStubs()
    const reports: InfraHealth[] = []
    mockFsHealthy()

    const monitor = new VaultHealthMonitor(watcher, errorLog, (h) => reports.push(h))
    // Only record heartbeat, no file changes
    monitor.recordWorkerHeartbeat(Date.now())

    monitor.start('/fake/vault')
    await vi.advanceTimersByTimeAsync(1)

    const workerCheck = reports[0].runs.find((r) => r.checkId === 'worker-responsive')
    expect(workerCheck?.passed).toBe(true)

    monitor.stop()
  })

  it('self-write suppression: EEXIST on pending write path does not trip recent-disk-errors', () => {
    const pendingPaths = new Set(['/pending-write.md'])
    const log = new FsErrorLog(32, (path) => pendingPaths.has(path))

    // Simulate an EEXIST error on a path we are currently writing to
    log.push('/pending-write.md', 'EEXIST: file already exists')

    // Should be suppressed
    const drained = log.drain()
    expect(drained).toHaveLength(0)
  })
})
