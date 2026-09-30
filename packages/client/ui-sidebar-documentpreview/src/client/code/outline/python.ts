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
    while (true) {
      const top = stack.at(-1)
      if (top === undefined || top.indent < untilIndent) break
      stack.pop()
      const finished: OutlineNode = top.children.length === 0
        ? { kind: top.node.kind, name: top.node.name, line: top.node.line }
        : { kind: top.node.kind, name: top.node.name, line: top.node.line, children: top.children }
      const parent = stack.at(-1)
      if (parent === undefined) roots.push(finished)
      else parent.children.push(finished)
    }
  }

  let lineNumber = 0
  for (const raw of lines) {
    lineNumber += 1
    if (raw.trim().length === 0 || raw.trimStart().startsWith('#')) continue
    const indent = raw.length - raw.trimStart().length
    const trimmed = raw.trimStart()
    finish(indent)

    const classMatch = CLASS.exec(trimmed)
    if (classMatch?.[1] !== undefined) {
      stack.push({ indent, node: { kind: 'class', name: classMatch[1], line: lineNumber }, children: [] })
      continue
    }
    const defMatch = DEF.exec(trimmed)
    if (defMatch?.[2] !== undefined) {
      const enclosing = stack.at(-1)
      const kind = enclosing !== undefined && enclosing.node.kind === 'class' ? 'method' : 'function'
      stack.push({ indent, node: { kind, name: defMatch[2], line: lineNumber }, children: [] })
    }
  }

  finish(0)
  return roots
}
