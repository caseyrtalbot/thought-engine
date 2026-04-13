import type { VaultWatcher } from './vault-watcher'
import type { FsErrorLog } from './fs-error-log'
import type { InfraHealth, CheckRun, HealthIssue } from '@shared/engine/vault-health'
import { TE_DIR } from '@shared/constants'
import { stat, access, constants } from 'fs/promises'
import { join } from 'path'

export class VaultHealthMonitor {
  private interval: ReturnType<typeof setInterval> | null = null
  private lastFileChangeAt = 0
  private lastWorkerHeartbeatAt = 0
  private vaultPath: string | null = null

  constructor(
    private readonly watcher: VaultWatcher,
    private readonly errorLog: FsErrorLog,
    private readonly onReport: (health: InfraHealth) => void
  ) {}

  start(vaultPath: string): void {
    this.vaultPath = vaultPath
    this.tick()
    this.interval = setInterval(() => this.tick(), 30_000)
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
    this.vaultPath = null
    this.lastFileChangeAt = 0
    this.lastWorkerHeartbeatAt = 0
  }

  recordFileChange(): void {
    this.lastFileChangeAt = Date.now()
  }

  recordWorkerHeartbeat(at: number): void {
    this.lastWorkerHeartbeatAt = at
  }

  requestTick(): void {
    this.tick()
  }

  switchVault(newPath: string): void {
    this.lastFileChangeAt = 0
    this.lastWorkerHeartbeatAt = 0
    this.vaultPath = newPath
  }

  private async tick(): Promise<void> {
    try {
      const runs = await Promise.all([
        this.checkVaultReachable(),
        this.checkWatcherAlive(),
        this.checkWorkerResponsive(),
        this.checkRecentDiskErrors()
      ])
      this.onReport({ runs, computedAt: Date.now() })
    } catch (err) {
      this.onReport({
        runs: [
          {
            checkId: 'recent-disk-errors',
            ranAt: Date.now(),
            passed: false,
            issues: [
              {
                checkId: 'recent-disk-errors',
                severity: 'hard',
                title: 'Health tick crashed',
                detail: err instanceof Error ? err.message : String(err)
              }
            ]
          }
        ],
        computedAt: Date.now()
      })
    }
  }

  private async checkVaultReachable(): Promise<CheckRun> {
    const ranAt = Date.now()
    const issues: HealthIssue[] = []

    try {
      const s = await stat(this.vaultPath!)
      if (!s.isDirectory()) {
        issues.push({
          checkId: 'vault-reachable',
          severity: 'hard',
          title: 'Vault path is not a directory',
          detail: `${this.vaultPath} exists but is not a directory`
        })
      }
    } catch (err) {
      issues.push({
        checkId: 'vault-reachable',
        severity: 'hard',
        title: 'Vault path unreachable',
        detail: err instanceof Error ? err.message : String(err)
      })
      return { checkId: 'vault-reachable', ranAt, passed: false, issues }
    }

    try {
      await access(join(this.vaultPath!, TE_DIR), constants.W_OK)
    } catch (err) {
      issues.push({
        checkId: 'vault-reachable',
        severity: 'hard',
        title: 'TE directory not writable',
        detail: err instanceof Error ? err.message : String(err)
      })
    }

    return { checkId: 'vault-reachable', ranAt, passed: issues.length === 0, issues }
  }

  private async checkWatcherAlive(): Promise<CheckRun> {
    const ranAt = Date.now()
    const snapshot = this.watcher.getHealthSnapshot()
    const issues: HealthIssue[] = []

    if (!snapshot.ready) {
      issues.push({
        checkId: 'watcher-alive',
        severity: 'hard',
        title: 'File watcher not ready',
        detail: 'Chokidar watcher has not emitted a ready event'
      })
    }

    if (snapshot.lastError !== null) {
      issues.push({
        checkId: 'watcher-alive',
        severity: 'hard',
        title: 'File watcher error',
        detail: snapshot.lastError.error
      })
    }

    return { checkId: 'watcher-alive', ranAt, passed: issues.length === 0, issues }
  }

  private async checkWorkerResponsive(): Promise<CheckRun> {
    const ranAt = Date.now()

    if (this.lastFileChangeAt === 0) {
      return { checkId: 'worker-responsive', ranAt, passed: true, issues: [] }
    }

    const gap = this.lastFileChangeAt - this.lastWorkerHeartbeatAt
    if (gap > 10_000) {
      return {
        checkId: 'worker-responsive',
        ranAt,
        passed: false,
        issues: [
          {
            checkId: 'worker-responsive',
            severity: 'hard',
            title: 'Worker not responding',
            detail: `Last file change was ${gap}ms ahead of last worker heartbeat`
          }
        ]
      }
    }

    return { checkId: 'worker-responsive', ranAt, passed: true, issues: [] }
  }

  private async checkRecentDiskErrors(): Promise<CheckRun> {
    const ranAt = Date.now()
    const errors = this.errorLog.drain()

    if (errors.length === 0) {
      return { checkId: 'recent-disk-errors', ranAt, passed: true, issues: [] }
    }

    const issues: HealthIssue[] = errors.map((e) => ({
      checkId: 'recent-disk-errors' as const,
      severity: 'integrity' as const,
      title: 'Disk write error',
      detail: e.error,
      filePath: e.path
    }))

    return { checkId: 'recent-disk-errors', ranAt, passed: false, issues }
  }
}
