/**
 * Append-only NDJSON audit logger for security-relevant operations.
 *
 * Writes are fire-and-forget: the caller is never blocked by disk I/O,
 * and write errors are swallowed (logged to stderr) to avoid crashing
 * the main process.
 *
 * Daily file rotation: audit-YYYY-MM-DD.ndjson
 */

import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AuditEntry } from '@shared/agent-types'

export class AuditLogger {
  private readonly logDir: string
  private dirEnsurePromise: Promise<unknown> | null = null

  constructor(logDir: string) {
    this.logDir = logDir
  }

  /**
   * Append an audit entry. Fire-and-forget: returns immediately,
   * writes asynchronously.
   */
  log(entry: AuditEntry): void {
    this.writeEntry(entry).catch((err) => {
      process.stderr.write(`[audit-logger] write failed: ${String(err)}\n`)
    })
  }

  // -- Internal --

  private async writeEntry(entry: AuditEntry): Promise<void> {
    await this.ensureDir()

    const filename = this.filenameForDate(new Date())
    const filePath = join(this.logDir, filename)
    const line = JSON.stringify(entry) + '\n'

    await appendFile(filePath, line, 'utf-8')
  }

  private async ensureDir(): Promise<void> {
    if (!this.dirEnsurePromise) {
      this.dirEnsurePromise = mkdir(this.logDir, { recursive: true }).catch((err) => {
        this.dirEnsurePromise = null
        throw err
      })
    }
    await this.dirEnsurePromise
  }

  private filenameForDate(date: Date): string {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `audit-${yyyy}-${mm}-${dd}.ndjson`
  }
}
