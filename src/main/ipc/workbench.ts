import { ProjectWatcher } from '../services/project-watcher'
import { ProjectSessionParser } from '../services/project-session-parser'
import { SessionTailer } from '../services/session-tailer'
import { typedHandle, typedSend } from '../typed-ipc'
import { getMainWindow } from '../window-registry'

const watcher = new ProjectWatcher()
const parser = new ProjectSessionParser()
let tailer: SessionTailer | null = null

export function registerProjectIpc(): void {
  typedHandle('workbench:watch-start', async (args) => {
    await watcher.start(args.projectPath, (event) => {
      const window = getMainWindow()
      if (window) {
        typedSend(window, 'workbench:file-changed', event)
      }
    })
  })

  typedHandle('workbench:watch-stop', async () => {
    await watcher.stop()
  })

  typedHandle('workbench:parse-sessions', async (args) => {
    return parser.parse(args.projectPath)
  })

  tailer = new SessionTailer(() => getMainWindow())

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
