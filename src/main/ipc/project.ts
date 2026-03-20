import type { BrowserWindow } from 'electron'
import { ProjectWatcher } from '../services/project-watcher'
import { ProjectSessionParser } from '../services/project-session-parser'
import { typedHandle, typedSend } from '../typed-ipc'

const watcher = new ProjectWatcher()
const parser = new ProjectSessionParser()

export function registerProjectIpc(mainWindow: BrowserWindow): void {
  typedHandle('project:watch-start', async (args) => {
    await watcher.start(args.projectPath, (event) => {
      typedSend(mainWindow, 'project:file-changed', event)
    })
  })

  typedHandle('project:watch-stop', async () => {
    await watcher.stop()
  })

  typedHandle('project:parse-sessions', async (args) => {
    return parser.parse(args.projectPath)
  })
}

export function getProjectWatcher(): ProjectWatcher {
  return watcher
}
