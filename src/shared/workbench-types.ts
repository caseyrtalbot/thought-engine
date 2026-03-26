export interface WorkbenchSessionEvent {
  readonly type: 'file-read' | 'file-write' | 'file-edit' | 'bash-command' | 'user-prompt'
  readonly timestamp: number
  readonly sessionId: string
  readonly filePath?: string
  readonly detail?: string
}

export interface WorkbenchFileChangedEvent {
  readonly path: string
  readonly event: 'add' | 'change' | 'unlink'
  readonly relativePath: string
}

export interface SessionToolEvent {
  readonly tool: 'Read' | 'Write' | 'Edit' | 'Bash' | 'Grep'
  readonly timestamp: number
  readonly filePath?: string
  readonly detail?: string
}

export interface SessionMilestone {
  readonly id: string
  /** Identifies which Claude session produced this milestone. Always set by SessionTailer. */
  readonly sessionId?: string
  readonly type: 'edit' | 'create' | 'command' | 'research' | 'error' | 'session-switched'
  readonly timestamp: number
  readonly summary: string
  readonly files: readonly string[]
  readonly events: readonly SessionToolEvent[]
}

export interface SessionDetectedEvent {
  readonly active: boolean
  readonly sessionId: string
}
