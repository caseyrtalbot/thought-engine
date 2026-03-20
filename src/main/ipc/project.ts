import type { BrowserWindow } from 'electron'
import { ProjectWatcher } from '../services/project-watcher'
import { ProjectSessionParser } from '../services/project-session-parser'
import { SessionTailer } from '../services/session-tailer'
import { typedHandle, typedSend } from '../typed-ipc'

const watcher = new ProjectWatcher()
const parser = new ProjectSessionParser()
let tailer: SessionTailer | null = null

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

  tailer = new SessionTailer(mainWindow)

  typedHandle('session:tail-start', async (args) => {
    await tailer!.start(args.projectPath)
  })

  typedHandle('session:tail-stop', async () => {
    await tailer!.stop()
  })
}

export function getProjectWatcher(): ProjectWatcher {
  return watcher
}

export function getSessionTailer(): SessionTailer | null {
  return tailer
}
