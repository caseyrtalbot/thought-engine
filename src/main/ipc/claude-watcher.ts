import type { BrowserWindow } from 'electron'
import { ClaudeSessionWatcher } from '../services/claude-session-watcher'
import { typedHandle, typedSend } from '../typed-ipc'

const watcher = new ClaudeSessionWatcher()

export function registerClaudeWatcherIpc(mainWindow: BrowserWindow): void {
  typedHandle('claude:watch-start', async (args) => {
    await watcher.start(args.configPath, (event) => {
      typedSend(mainWindow, 'claude:activity', event)
    })
  })

  typedHandle('claude:watch-stop', async () => {
    await watcher.stop()
  })
}

export function getClaudeWatcher(): ClaudeSessionWatcher {
  return watcher
}
