import { spawn, type IPty } from 'node-pty'
import { randomUUID } from 'crypto'
import { type SessionId, sessionId } from '@shared/types'

export type DataCallback = (id: SessionId, data: string) => void
export type ExitCallback = (id: SessionId, code: number) => void

export class ShellService {
  private sessions = new Map<SessionId, IPty>()
  private onData: DataCallback = () => {}
  private onExit: ExitCallback = () => {}

  setCallbacks(onData: DataCallback, onExit: ExitCallback): void {
    this.onData = onData
    this.onExit = onExit
  }

  create(cwd: string, shell?: string): SessionId {
    const id = sessionId(randomUUID())
    const defaultShell = shell || process.env.SHELL || '/bin/zsh'

    const pty = spawn(defaultShell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...(process.env as Record<string, string>),
        // Disable zsh partial-line indicator (highlighted "%") on fresh spawn
        PROMPT_EOL_MARK: ''
      }
    })

    pty.onData((data) => this.onData(id, data))
    pty.onExit(({ exitCode }) => {
      this.onExit(id, exitCode)
      this.sessions.delete(id)
    })

    this.sessions.set(id, pty)
    return id
  }

  write(id: SessionId, data: string): void {
    this.sessions.get(id)?.write(data)
  }

  resize(id: SessionId, cols: number, rows: number): void {
    this.sessions.get(id)?.resize(cols, rows)
  }

  kill(id: SessionId): void {
    this.sessions.get(id)?.kill()
    this.sessions.delete(id)
  }

  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id)
    }
  }

  getProcessName(id: SessionId): string | null {
    const pty = this.sessions.get(id)
    return pty?.process ?? null
  }
}
