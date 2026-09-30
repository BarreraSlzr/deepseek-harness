/** Shallow JSON outline from top-level object keys or array indexes. */
import type { OutlineNode } from './types.ts'

/**
 * Build a shallow outline of top-level JSON keys or array indexes.
 * Invalid JSON yields an empty outline.
 * @param text - UTF-8 JSON text.
 * @returns outline roots.
 */
export function outlineJson(text: string): OutlineNode[] {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch {
    // Truncated or invalid preview pages are common while streaming.
    return []
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const lines = topLevelKeyLines(text)
    return Object.keys(value as Record<string, unknown>).map((name, index) => ({
      kind: 'property' as const,
      name,
      line: resolveOutlineLine(lines.get(name), index + 2, text),
    }))
  }
  if (Array.isArray(value)) {
    const lines = topLevelArrayElementLines(text)
    return value.slice(0, 50).map((_, index) => ({
      kind: 'section' as const,
      name: `[${index}]`,
      line: resolveOutlineLine(lines[index], index + 1, text),
    }))
  }
  return []
}

/**
 * Prefer a scanned 1-based line; fall back when the one-pass index missed a key
 * (for example a colon on the following line).
 * @param found - scanned line, when present.
 * @param hint - 1-based hint from key/element order.
 * @param text - full JSON text (for clamping to the last line).
 */
function resolveOutlineLine(found: number | undefined, hint: number, text: string): number {
  if (found !== undefined) return found
  return Math.min(hint, Math.max(1, lineCount(text)))
}

/**
 * One-pass map of top-level object keys to their 1-based source lines.
 * @param text - JSON source.
 */
function topLevelKeyLines(text: string): Map<string, number> {
  const map = new Map<string, number>()
  let depth = 0
  let inString = false
  let escape = false
  let line = 1
  let keyStart = -1
  let keyLine = 1

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i)
    if (ch === '\n') {
      line += 1
      continue
    }
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = false
        if (depth === 1 && keyStart >= 0) {
          let j = i + 1
          while (j < text.length && (text.charAt(j) === ' ' || text.charAt(j) === '\t' || text.charAt(j) === '\r')) j += 1
          if (text.charAt(j) === ':') {
            // Successfully parsed JSON only contains valid JSON string keys.
            const key = JSON.parse(text.slice(keyStart, i + 1)) as string
            if (!map.has(key)) map.set(key, keyLine)
          }
        }
        keyStart = -1
      }
      continue
    }
    if (ch === '"') {
      inString = true
      if (depth === 1) {
        keyStart = i
        keyLine = line
      }
      continue
    }
    if (ch === '{' || ch === '[') depth += 1
    else if (ch === '}' || ch === ']') depth -= 1
  }
  return map
}

/**
 * One-pass 1-based lines for each top-level array element's start.
 * @param text - JSON source.
 */
function topLevelArrayElementLines(text: string): number[] {
  const lines: number[] = []
  let depth = 0
  let inString = false
  let escape = false
  let line = 1
  let expectElement = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i)
    if (ch === '\n') {
      line += 1
      continue
    }
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      if (depth === 1 && expectElement) {
        lines.push(line)
        expectElement = false
      }
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') {
      if (depth === 1 && expectElement) {
        lines.push(line)
        expectElement = false
      }
      depth += 1
      if (depth === 1 && ch === '[') expectElement = true
      continue
    }
    if (ch === '}' || ch === ']') {
      depth -= 1
      continue
    }
    if (depth === 1 && ch === ',') {
      expectElement = true
      continue
    }
    if (depth === 1 && expectElement && !isJsonWhitespace(ch)) {
      lines.push(line)
      expectElement = false
    }
  }
  return lines
}

function isJsonWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r'
}

function lineCount(text: string): number {
  let count = 1
  for (const ch of text) {
    if (ch === '\n') count += 1
  }
  return count
}
