/**
 * Rewrite [[wikilink]] references when a file is renamed.
 * Replaces [[oldStem]] and [[oldStem|display]] with [[newStem]] and [[newStem|display]].
 * Case-insensitive: matches [[OldStem]], [[oldStem]], [[OLDSTEM]], etc.
 * Also handles path-prefixed links: [[path/oldStem]] → [[path/newStem]].
 */
export function rewriteWikilinks(content: string, oldStem: string, newStem: string): string {
  const escaped = oldStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match [[oldStem]] and [[oldStem|alias]] (case-insensitive)
  const bareRegex = new RegExp(`\\[\\[${escaped}(\\|[^\\]]*)?\\]\\]`, 'gi')
  // Match [[path/oldStem]] and [[path/oldStem|alias]] (case-insensitive, preserve path prefix)
  const pathRegex = new RegExp(`\\[\\[([^\\]|]*/)${escaped}(\\|[^\\]]*)?\\]\\]`, 'gi')
  const withPathReplaced = content.replace(
    pathRegex,
    (_match, pathPrefix: string, alias?: string) => `[[${pathPrefix}${newStem}${alias ?? ''}]]`
  )
  return withPathReplaced.replace(
    bareRegex,
    (_match, alias?: string) => `[[${newStem}${alias ?? ''}]]`
  )
}
