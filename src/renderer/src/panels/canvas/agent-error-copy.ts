import type { AgentErrorTag } from '@shared/agent-action-types'

interface TaggedError {
  readonly error: string
  readonly tag?: AgentErrorTag
}

export function agentErrorCopy(err: TaggedError): string {
  switch (err.tag) {
    case 'stalled':
      return 'Agent stalled. Try a smaller selection.'
    case 'cap':
      return 'Agent exceeded 3-minute limit. Try fewer cards.'
    case 'not-found':
      return "Couldn't find Claude CLI. Run `which claude` in terminal."
    case 'invalid-output':
      return 'Agent returned invalid output. Try again.'
    case 'cli-error': {
      const lastLine = err.error.trim().split('\n').pop() ?? 'unknown'
      return `Agent error: ${lastLine.slice(0, 140)}`
    }
    default:
      return err.error
  }
}
