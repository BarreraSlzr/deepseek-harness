/** Top-level YAML key outline (column-0 mappings). */
import type { OutlineNode } from './types.ts'

const TOP_KEY = /^([A-Za-z_][\w.-]*)\s*:/u

/**
 * Build an outline from top-level YAML mapping keys (no leading indent).
 * @param text - UTF-8 YAML text.
 * @returns outline roots.
 */
export function outlineYaml(text: string): OutlineNode[] {
  const roots: OutlineNode[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line === undefined) continue
    if (line.length === 0 || line.startsWith(' ') || line.startsWith('\t') || line.startsWith('#')) continue
    if (line.startsWith('---') || line.startsWith('...')) continue
    const match = TOP_KEY.exec(line)
    if (match?.[1] === undefined) continue
    roots.push({ kind: 'property', name: match[1], line: i + 1 })
  }
  return roots
}
