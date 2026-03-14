import type { BrowserWindow } from 'electron'
import { ShellService } from '../services/shell-service'
import { typedHandle, typedSend } from '../typed-ipc'

const shellService = new ShellService()

export function registerShellIpc(mainWindow: BrowserWindow): void {
  shellService.setCallbacks(
    (sessionId, data) => {
      typedSend(mainWindow, 'terminal:data', { sessionId, data })
    },
    (sessionId, code) => {
      typedSend(mainWindow, 'terminal:exit', { sessionId, code })
    }
  )

  typedHandle('terminal:create', async (args) => {
    return shellService.create(args.cwd, args.shell)
  })

  typedHandle('terminal:write', async (args) => {
    shellService.write(args.sessionId, args.data)
  })

  typedHandle('terminal:resize', async (args) => {
    shellService.resize(args.sessionId, args.cols, args.rows)
  })

  typedHandle('terminal:kill', async (args) => {
    shellService.kill(args.sessionId)
  })

  typedHandle('terminal:process-name', async (args) => {
    return shellService.getProcessName(args.sessionId)
  })
}

export function getShellService(): ShellService {
  return shellService
}
