import type { SessionToolEvent } from '@shared/workbench-types'

/** Convert an absolute path to Claude's directory key format. */
export function toDirKey(projectPath: string): string {
  return projectPath.replace(/\//g, '-')
}

const TOOL_NAMES_WITH_PATH = new Set(['Read', 'Write', 'Edit', 'Grep'])

interface JsonlEntry {
  type?: string
  timestamp?: string
  message?: {
    role?: string
    content?: unknown
  }
}

interface ToolUseBlock {
  type: 'tool_use'
  name: string
  id?: string
  input?: Record<string, unknown>
}

function extractToolUseBlocks(content: unknown): ToolUseBlock[] {
  if (!Array.isArray(content)) return []
  return content.filter(
    (block): block is ToolUseBlock =>
      block && typeof block === 'object' && block.type === 'tool_use'
  )
}

/** Parse a single JSONL line and extract typed tool events from assistant messages. */
export function extractToolEvents(jsonLine: string): SessionToolEvent[] {
  try {
    const entry: JsonlEntry = JSON.parse(jsonLine)

    if (entry.type !== 'assistant' || entry.message?.role !== 'assistant') return []

    const messageContent = entry.message?.content
    const toolBlocks = extractToolUseBlocks(messageContent)
    const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now()

    const events: SessionToolEvent[] = []

    for (const block of toolBlocks) {
      const tool = block.name as SessionToolEvent['tool']

      if (TOOL_NAMES_WITH_PATH.has(block.name)) {
        const filePath =
          (block.input?.file_path as string | undefined) ||
          (block.input?.path as string | undefined) ||
          undefined

        let detail: string | undefined
        if (block.name === 'Edit' && block.input?.new_string) {
          detail = (block.input.new_string as string).slice(0, 200)
        }

        events.push({ tool, timestamp, filePath, detail })
      } else if (block.name === 'Bash') {
        const command = block.input?.command as string | undefined
        events.push({ tool, timestamp, detail: command?.slice(0, 100) })
      }
    }

    return events
  } catch {
    return []
  }
}
