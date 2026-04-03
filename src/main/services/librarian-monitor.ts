import type { AgentSidecarState } from '@shared/agent-types'

interface TrackedSession {
  readonly sessionId: string
  readonly pid: number
  readonly cwd: string
  readonly startedAt: string
  status: 'alive' | 'exited'
  exitCode?: number
  killFn?: () => void
}

type OnChange = (states: AgentSidecarState[]) => void

/**
 * Lightweight process monitor for librarian child processes.
 * Emits AgentSidecarState-shaped snapshots compatible with the
 * existing agent:states-changed IPC pipeline.
 */
export class LibrarianMonitor {
  private sessions = new Map<string, TrackedSession>()
  private onChange: OnChange | null = null

  setOnChange(cb: OnChange): void {
    this.onChange = cb
  }

  register(sessionId: string, pid: number, cwd: string, killFn?: () => void): void {
    this.sessions.set(sessionId, {
      sessionId,
      pid,
      cwd,
      startedAt: new Date().toISOString(),
      status: 'alive',
      killFn
    })
    this.notify()
  }

  complete(sessionId: string, exitCode: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.status = 'exited'
    session.exitCode = exitCode
    this.notify()
  }

  cleanup(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.notify()
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.killFn?.()
  }

  getStates(): AgentSidecarState[] {
    return [...this.sessions.values()].map((s) => ({
      sessionId: s.sessionId,
      tmuxName: `librarian-${s.sessionId.slice(0, 8)}`,
      status: s.status,
      pid: s.pid,
      startedAt: s.startedAt,
      label: 'librarian',
      cwd: s.cwd
    }))
  }

  /** Kill all active librarian sessions. */
  killAll(): void {
    for (const session of this.sessions.values()) {
      if (session.status === 'alive') {
        session.killFn?.()
      }
    }
  }

  private notify(): void {
    this.onChange?.(this.getStates())
  }
}
