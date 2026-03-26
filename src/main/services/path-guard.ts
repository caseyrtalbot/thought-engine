/**
 * PathGuard enforces vault-scoped file access.
 *
 * All file paths are resolved (including symlinks) and checked against
 * the vault root before any I/O is allowed. A deny list blocks access
 * to sensitive directories regardless of location.
 */

import { realpathSync } from 'node:fs'
import { resolve, normalize } from 'node:path'
import { PathGuardError } from '@shared/agent-types'

/** Segments that are always denied, even inside the vault. */
const DENY_LIST = new Set(['.git', '.ssh', '.env', 'node_modules', '.DS_Store'])

/**
 * Stateless path guard bound to a specific vault root.
 *
 * Create one instance per active vault. All methods are synchronous
 * because path validation must complete before any I/O begins.
 */
export class PathGuard {
  private readonly resolvedRoot: string

  constructor(vaultRoot: string) {
    // Resolve the vault root once at construction time.
    // Use normalize + resolve as a fallback if realpathSync fails
    // (e.g. vault root doesn't exist yet during tests).
    try {
      this.resolvedRoot = realpathSync(resolve(normalize(vaultRoot)))
    } catch {
      this.resolvedRoot = resolve(normalize(vaultRoot))
    }
  }

  /**
   * Resolve a file path and verify it falls within the vault root.
   *
   * @returns The fully-resolved, normalized path.
   * @throws PathGuardError if the path is outside the vault, contains
   *         null bytes, or matches the deny list.
   */
  assertWithinVault(filePath: string): string {
    this.rejectNullBytes(filePath)

    const normalized = this.normalizePath(filePath)
    const resolved = this.resolvePath(normalized)

    this.checkBoundary(resolved)
    this.checkDenyList(resolved)

    return resolved
  }

  // -- Private helpers (each does one check, throws on failure) --

  private rejectNullBytes(filePath: string): void {
    if (filePath.includes('\0')) {
      throw new PathGuardError(filePath, this.resolvedRoot, 'Path contains null bytes')
    }
  }

  /**
   * NFC-normalize and resolve the path. Unicode normalization prevents
   * macOS NFD decomposition from creating distinct-looking paths that
   * resolve to the same file.
   */
  private normalizePath(filePath: string): string {
    return filePath.normalize('NFC')
  }

  /**
   * Resolve the path to an absolute form, following symlinks when
   * the target exists on disk.
   */
  private resolvePath(filePath: string): string {
    const absolute = resolve(normalize(filePath))
    try {
      return realpathSync(absolute)
    } catch {
      // File may not exist yet (e.g. write operations).
      // Fall back to the logical resolved path.
      return absolute
    }
  }

  private checkBoundary(resolved: string): void {
    const normalizedResolved = resolved.normalize('NFC')
    const normalizedRoot = this.resolvedRoot.normalize('NFC')

    if (
      normalizedResolved !== normalizedRoot &&
      !normalizedResolved.startsWith(normalizedRoot + '/')
    ) {
      throw new PathGuardError(resolved, this.resolvedRoot, 'Path is outside vault boundary')
    }
  }

  private checkDenyList(resolved: string): void {
    // Split the path relative to vault root and check each segment.
    const relative = resolved.slice(this.resolvedRoot.length + 1)
    const segments = relative.split('/')

    for (const segment of segments) {
      if (DENY_LIST.has(segment)) {
        throw new PathGuardError(
          resolved,
          this.resolvedRoot,
          `Path contains denied segment: ${segment}`
        )
      }
    }
  }
}
