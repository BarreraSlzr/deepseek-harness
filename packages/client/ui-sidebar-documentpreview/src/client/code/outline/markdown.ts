/** Markdown / MDX ATX heading outline nested by heading level. */
import type { OutlineNode } from './types.ts'

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/u

/**
 * Build a heading tree from ATX markdown headings.
 * @param text - UTF-8 markdown.
 * @returns outline roots.
 */
export function outlineMarkdown(text: string): OutlineNode[] {
  const lines = text.split('\n')
  const roots: OutlineNode[] = []
  const stack: { level: number; node: OutlineNode; children: OutlineNode[] }[] = []

  const finish = (untilLevel: number): void => {
    while (stack.length > 0) {
      const peek = stack[stack.length - 1]
      if (peek === undefined || peek.level < untilLevel) break
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
    const line = lines[i]
    if (line === undefined) continue
    const match = HEADING.exec(line)
    if (match === null) continue
    const marks = match[1]
    const rawName = match[2]
    if (marks === undefined || rawName === undefined) continue
    const name = rawName.trim()
    if (name.length === 0) continue
    finish(marks.length)
    stack.push({ level: marks.length, node: { kind: 'heading', name, line: i + 1 }, children: [] })
  }

  finish(0)
  return roots
}
