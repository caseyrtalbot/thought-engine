import { randomUUID } from 'crypto'
import { join } from 'path'
import type { ShellService } from './shell-service'
import type { AgentSpawnRequest } from '@shared/agent-types'
import type { SessionId } from '@shared/types'

export class AgentSpawner {
  constructor(
    private readonly shellService: ShellService,
    private readonly vaultRoot: string
  ) {}

  spawn(request: AgentSpawnRequest): SessionId {
    const sessionId = randomUUID()
    const wrapperPath = join(__dirname, '../../scripts/agent-wrapper.sh')

    const promptArg = request.prompt ? ` --prompt "${request.prompt}"` : ''

    const shellCmd =
      `bash ${wrapperPath}` +
      ` --session-id ${sessionId}` +
      ` --vault-root ${this.vaultRoot}` +
      ` --cwd ${request.cwd}` +
      promptArg

    const label = `agent:${sessionId.slice(0, 8)}`

    return this.shellService.create(request.cwd, shellCmd, label, this.vaultRoot)
  }
}
