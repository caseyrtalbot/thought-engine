import { realpathSync } from 'node:fs'
import { basename, dirname, join, normalize, resolve } from 'path'
import { SYSTEM_ARTIFACT_DIRECTORIES, type SystemArtifactKind } from '@shared/system-artifacts'
import { TE_DIR } from '@shared/constants'
const CONFIG_FILE = 'config.json'
const STATE_FILE = 'state.json'
const ARTIFACTS_DIR = 'artifacts'

export function teConfigPath(vaultPath: string): string {
  return join(vaultPath, TE_DIR, CONFIG_FILE)
}

export function teStatePath(vaultPath: string): string {
  return join(vaultPath, TE_DIR, STATE_FILE)
}

export function teDirPath(vaultPath: string): string {
  return join(vaultPath, TE_DIR)
}

export function teArtifactsDirPath(vaultPath: string): string {
  return join(vaultPath, TE_DIR, ARTIFACTS_DIR)
}

export function teArtifactKindDirPath(vaultPath: string, kind: SystemArtifactKind): string {
  return join(vaultPath, TE_DIR, ARTIFACTS_DIR, SYSTEM_ARTIFACT_DIRECTORIES[kind])
}

export function teArtifactPath(
  vaultPath: string,
  kind: SystemArtifactKind,
  filename: string
): string {
  return join(teArtifactKindDirPath(vaultPath, kind), filename)
}

export function canonicalizePath(path: string): string {
  const absolute = resolve(normalize(path.normalize('NFC')))
  const unresolvedTail: string[] = []
  let current = absolute

  while (true) {
    try {
      const resolvedExisting = realpathSync(current)
      return unresolvedTail.length === 0
        ? resolvedExisting
        : join(resolvedExisting, ...unresolvedTail.reverse())
    } catch {
      const parent = dirname(current)
      if (parent === current) {
        return absolute
      }
      unresolvedTail.push(basename(current))
      current = parent
    }
  }
}

export function assertWithinVault(vaultPath: string, targetPath: string): string {
  const normalizedTarget = canonicalizePath(targetPath)
  const normalizedVault = canonicalizePath(vaultPath)
  if (!normalizedTarget.startsWith(normalizedVault + '/') && normalizedTarget !== normalizedVault) {
    throw new Error(`Path is outside vault boundary`)
  }
  return normalizedTarget
}
