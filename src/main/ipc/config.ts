import { ipcMain } from 'electron'
import StoreModule from 'electron-store'

// electron-store v11+ is ESM-only; when bundled as CJS the default
// export lands on .default.  Handle both cases for safety.
const Store = (StoreModule as any).default ?? StoreModule
const appStore = new Store({ name: 'thought-engine-settings' })

export function registerConfigIpc(): void {
  ipcMain.handle('config:read', async (_e, args: { scope: string; key: string }) => {
    if (args.scope === 'app') return appStore.get(args.key, null)
    return null
  })
  ipcMain.handle(
    'config:write',
    async (_e, args: { scope: string; key: string; value: unknown }) => {
      if (args.scope === 'app') appStore.set(args.key, args.value)
    }
  )
}
