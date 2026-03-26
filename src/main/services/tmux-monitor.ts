import { readFileSync } from 'fs'
import { join } from 'path'
import type { AgentSidecarState, AgentSidecar } from '@shared/agent-types'
import { tmuxExec, SESSION_PREFIX, readSessionMeta, verifyTmuxAvailable } from './tmux-paths'

/** Shell commands that indicate an idle (waiting for input) session. */
const KNOWN_SHELLS = new Set(['bash', 'zsh', 'fish', 'sh', '-bash', '-zsh', '-fish', '-sh'])

/**
 * Polls tmux sessions on the machina socket and builds AgentSidecarState snapshots.
 * Designed to be non-destructive: read-only observation of tmux + sidecar files.
 */
const DEFAULT_POLL_INTERVAL_MS = 3000

export class TmuxMonitor {
  private readonly vaultRoot: string
  private readonly pollIntervalMs: number
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private previousSnapshot: string | null = null

  constructor(vaultRoot: string, pollIntervalMs?: number) {
    this.vaultRoot = vaultRoot
    this.pollIntervalMs = pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  }

  /**
   * Factory: returns a TmuxMonitor if tmux >= 2.6 is available, otherwise null.
   * Safe to call in CI or environments without tmux.
   */
  static tryCreate(vaultRoot: string, pollIntervalMs?: number): TmuxMonitor | null {
    if (!verifyTmuxAvailable()) return null
    return new TmuxMonitor(vaultRoot, pollIntervalMs)
  }

  /** Get current agent states (one-shot, no polling). */
  getAgentStates(): AgentSidecarState[] {
    const sessions = this.listTeSessions()
    return sessions.map((tmuxName) => {
      const sessionId = tmuxName.slice(SESSION_PREFIX.length)
      const paneInfo = this.getPaneInfo(tmuxName)
      const meta = readSessionMeta(sessionId)
      const sidecar = this.readSidecar(sessionId)
      const status = this.deriveStatus(paneInfo.currentCommand)
      return {
        sessionId,
        tmuxName,
        status,
        ...paneInfo,
        ...(meta
          ? {
              startedAt: meta.createdAt,
              label: meta.label,
              cwd: meta.cwd
            }
          : {}),
        ...(sidecar ? { sidecar } : {})
      }
    })
  }

  /** Start polling. Calls onChange when state differs from previous poll. */
  start(onChange: (states: AgentSidecarState[]) => void): void {
    this.stop()
    this.previousSnapshot = null
    const poll = (): void => {
      const states = this.getAgentStates()
      const snapshot = JSON.stringify(states)
      if (snapshot !== this.previousSnapshot) {
        this.previousSnapshot = snapshot
        onChange(states)
      }
    }
    poll()
    this.pollTimer = setInterval(poll, this.pollIntervalMs)
  }

  /** Stop polling. */
  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Derive session status from the pane's current command. */
  private deriveStatus(currentCommand?: string): AgentSidecarState['status'] {
    if (!currentCommand) return 'alive'
    return KNOWN_SHELLS.has(currentCommand) ? 'idle' : 'alive'
  }

  /** List tmux sessions that match the te- prefix. */
  private listTeSessions(): string[] {
    try {
      const output = tmuxExec('list-sessions', '-F', '#{session_name}')
      return output.split('\n').filter((name) => name.startsWith(SESSION_PREFIX))
    } catch {
      return []
    }
  }

  /** Read optional sidecar file at <vaultRoot>/.te/agents/<sessionId>.json */
  private readSidecar(sessionId: string): AgentSidecar | null {
    try {
      const raw = readFileSync(join(this.vaultRoot, '.te', 'agents', `${sessionId}.json`), 'utf-8')
      return JSON.parse(raw) as AgentSidecar
    } catch {
      return null
    }
  }

  /** Get pane PID and current command for a session. */
  private getPaneInfo(tmuxName: string): { pid?: number; currentCommand?: string } {
    try {
      const output = tmuxExec(
        'list-panes',
        '-t',
        tmuxName,
        '-F',
        '#{pane_pid} #{pane_current_command}'
      )
      const parts = output.split(' ')
      if (parts.length >= 2) {
        return {
          pid: parseInt(parts[0], 10),
          currentCommand: parts.slice(1).join(' ')
        }
      }
      return {}
    } catch {
      return {}
    }
  }
}
