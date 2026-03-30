import type { BrowserWindow } from 'electron'
import { typedHandle, typedSend } from '../typed-ipc'

export class QuitCoordinator {
  private pendingAckResolve: (() => void) | null = null

  registerIpc(): void {
    typedHandle('app:quit-ready', async () => {
      this.pendingAckResolve?.()
      this.pendingAckResolve = null
    })
  }

  async requestRendererFlush(
    getWindow: () => BrowserWindow | null,
    timeoutMs: number
  ): Promise<void> {
    const window = getWindow()
    if (!window || window.isDestroyed()) return

    await Promise.race([
      new Promise<void>((resolve) => {
        this.pendingAckResolve = resolve
        typedSend(window, 'app:will-quit', {})
      }),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    ])

    this.pendingAckResolve = null
  }
}
