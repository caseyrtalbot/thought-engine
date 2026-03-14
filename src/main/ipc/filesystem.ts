import { dialog, shell } from 'electron'
import { FileService } from '../services/file-service'
import { teConfigPath, teStatePath } from '../utils/paths'
import { typedHandle } from '../typed-ipc'
import type { VaultConfig, VaultState } from '../../shared/types'

const fileService = new FileService()

export function registerFilesystemIpc(): void {
  typedHandle('fs:read-file', async (args) => {
    return fileService.readFile(args.path)
  })

  typedHandle('fs:write-file', async (args) => {
    await fileService.writeFile(args.path, args.content)
  })

  typedHandle('fs:delete-file', async (args) => {
    await fileService.deleteFile(args.path)
  })

  typedHandle('fs:list-files', async (args) => {
    return fileService.listFiles(args.dir, args.pattern)
  })

  typedHandle('fs:list-files-recursive', async (args) => {
    return fileService.listFilesRecursive(args.dir)
  })

  typedHandle('fs:file-exists', async (args) => {
    const { existsSync } = await import('node:fs')
    return existsSync(args.path)
  })

  typedHandle('fs:select-vault', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  typedHandle('fs:rename-file', async (args) => {
    const { rename } = await import('node:fs/promises')
    await rename(args.oldPath, args.newPath)
  })

  typedHandle('fs:copy-file', async (args) => {
    const { copyFile } = await import('node:fs/promises')
    await copyFile(args.srcPath, args.destPath)
  })

  typedHandle('fs:create-folder', async (args) => {
    const result = await dialog.showOpenDialog({
      defaultPath: args.defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  typedHandle('fs:mkdir', async (args) => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(args.path, { recursive: true })
  })

  // --- Vault data ---

  typedHandle('vault:init', async (args) => {
    await fileService.initVault(args.vaultPath)
  })

  typedHandle('vault:read-config', async (args) => {
    const content = await fileService.readFile(teConfigPath(args.vaultPath))
    return JSON.parse(content) as VaultConfig
  })

  typedHandle('vault:write-config', async (args) => {
    await fileService.writeFile(teConfigPath(args.vaultPath), JSON.stringify(args.config, null, 2))
  })

  typedHandle('vault:read-state', async (args) => {
    const content = await fileService.readFile(teStatePath(args.vaultPath))
    return JSON.parse(content) as VaultState
  })

  typedHandle('vault:write-state', async (args) => {
    await fileService.writeFile(teStatePath(args.vaultPath), JSON.stringify(args.state, null, 2))
  })

  typedHandle('vault:list-commands', async (args) => {
    const { readdir } = await import('node:fs/promises')
    try {
      const entries = await readdir(args.dirPath)
      return entries.filter((f) => f.endsWith('.md')).map((f) => `${args.dirPath}/${f}`)
    } catch {
      return []
    }
  })

  typedHandle('vault:read-file', async (args) => {
    const { readFile } = await import('node:fs/promises')
    return readFile(args.filePath, 'utf-8')
  })

  // --- Shell integration ---

  typedHandle('shell:show-in-folder', async (args) => {
    shell.showItemInFolder(args.path)
  })

  typedHandle('shell:open-path', async (args) => {
    return shell.openPath(args.path)
  })

  typedHandle('shell:trash-item', async (args) => {
    await shell.trashItem(args.path)
  })
}
