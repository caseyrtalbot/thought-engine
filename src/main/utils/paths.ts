import { join, resolve, normalize } from 'path'

export const TE_DIR = '.thought-engine'
export const CONFIG_FILE = 'config.json'
export const STATE_FILE = 'state.json'

export function teConfigPath(vaultPath: string): string {
  return join(vaultPath, TE_DIR, CONFIG_FILE)
}

export function teStatePath(vaultPath: string): string {
  return join(vaultPath, TE_DIR, STATE_FILE)
}

export function teDirPath(vaultPath: string): string {
  return join(vaultPath, TE_DIR)
}

export function assertWithinVault(vaultPath: string, targetPath: string): void {
  const normalizedTarget = resolve(normalize(targetPath))
  const normalizedVault = resolve(normalize(vaultPath))
  if (!normalizedTarget.startsWith(normalizedVault + '/') && normalizedTarget !== normalizedVault) {
    throw new Error(`Path is outside vault boundary`)
  }
}
