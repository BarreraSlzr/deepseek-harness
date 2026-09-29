/** Heuristic Python outline from source text using indentation nesting. */
import type { OutlineNode } from './types.ts'

const DEF = /^(async\s+)?def\s+([A-Za-z_][\w]*)/u
const CLASS = /^class\s+([A-Za-z_][\w]*)/u

/**
 * Build a Python outline from `class` / `def` lines nested by indentation.
 * @param text - UTF-8 source.
 * @returns outline roots.
 */
export function outlinePython(text: string): OutlineNode[] {
  const lines = text.split('\n')
  const roots: OutlineNode[] = []
  const stack: { indent: number; node: OutlineNode; children: OutlineNode[] }[] = []

  const finish = (untilIndent: number): void => {
    while (stack.length > 0) {
      const peek = stack[stack.length - 1]
      if (peek === undefined || peek.indent < untilIndent) break
      const top = stack.pop()
      if (top === undefined) break
      const finished: OutlineNode = top.children.length === 0
        ? { kind: top.node.kind, name: top.node.name, line: top.node.line }
        : { kind: top.node.kind, name: top.node.name, line: top.node.line, children: top.children }
      const parent = stack[stack.length - 1]
      if (parent === undefined) roots.push(finished)
      else parent.children.push(finished)
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (raw === undefined) continue
    if (raw.trim().length === 0 || raw.trimStart().startsWith('#')) continue
    const indent = raw.length - raw.trimStart().length
    const trimmed = raw.trimStart()
    finish(indent)

    const classMatch = CLASS.exec(trimmed)
    if (classMatch?.[1] !== undefined) {
      stack.push({ indent, node: { kind: 'class', name: classMatch[1], line: i + 1 }, children: [] })
      continue
    }
    const defMatch = DEF.exec(trimmed)
    if (defMatch?.[2] !== undefined) {
      const enclosing = stack[stack.length - 1]
      const kind = enclosing !== undefined && enclosing.node.kind === 'class' ? 'method' : 'function'
      stack.push({ indent, node: { kind, name: defMatch[2], line: i + 1 }, children: [] })
    }
  }

  finish(0)
  return roots
}
