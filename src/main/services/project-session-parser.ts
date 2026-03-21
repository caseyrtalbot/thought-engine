import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { WorkbenchSessionEvent } from '@shared/workbench-types'
import { toDirKey, extractToolEvents } from './session-utils'

export class ProjectSessionParser {
  async parse(projectPath: string): Promise<WorkbenchSessionEvent[]> {
    const dirKey = toDirKey(projectPath)
    const claudeProjectDir = join(homedir(), '.claude', 'projects', dirKey)
    const events: WorkbenchSessionEvent[] = []

    let sessionFiles: string[]
    try {
      const entries = await readdir(claudeProjectDir)
      sessionFiles = entries.filter((f) => f.endsWith('.jsonl'))
    } catch {
      return events
    }

    for (const file of sessionFiles) {
      const sessionId = file.replace('.jsonl', '')
      const filePath = join(claudeProjectDir, file)

      try {
        const fileStat = await stat(filePath)
        // Skip very large session files (>10MB) to avoid blocking
        if (fileStat.size > 10 * 1024 * 1024) continue

        const content = await readFile(filePath, 'utf-8')
        const lines = content.split('\n').filter((l) => l.trim())

        for (const line of lines) {
          const toolEvents = extractToolEvents(line)
          for (const event of toolEvents) {
            const type =
              event.tool === 'Read'
                ? 'file-read'
                : event.tool === 'Write'
                  ? 'file-write'
                  : event.tool === 'Edit'
                    ? 'file-edit'
                    : event.tool === 'Bash'
                      ? 'bash-command'
                      : 'file-read'

            if (
              (event.tool === 'Read' || event.tool === 'Write' || event.tool === 'Edit') &&
              event.filePath
            ) {
              events.push({ type, timestamp: event.timestamp, sessionId, filePath: event.filePath })
            } else if (event.tool === 'Bash') {
              events.push({
                type: 'bash-command',
                timestamp: event.timestamp,
                sessionId,
                detail: event.detail
              })
            }
          }
        }
      } catch {
        // File read error
      }
    }

    events.sort((a, b) => a.timestamp - b.timestamp)
    return events
  }
}
