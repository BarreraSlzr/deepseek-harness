/** Markdown / MDX ATX heading outline nested by heading level. */
import type { OutlineNode } from './types.ts'

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/u
/** Opening or closing fenced code block (``` or ~~~), optional info string. */
const FENCE = /^(```|~~~)/u

/**
 * Build a heading tree from ATX markdown headings.
 * Headings inside fenced code blocks are ignored.
 * @param text - UTF-8 markdown.
 * @returns outline roots.
 */
export function outlineMarkdown(text: string): OutlineNode[] {
  const lines = text.split('\n')
  const roots: OutlineNode[] = []
  const stack: { level: number; node: OutlineNode; children: OutlineNode[] }[] = []
  let inFence = false

  const finish = (untilLevel: number): void => {
    while (true) {
      const top = stack.at(-1)
      if (top === undefined || top.level < untilLevel) break
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
  for (const line of lines) {
    lineNumber += 1
    if (FENCE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = HEADING.exec(line)
    if (match === null) continue
    const marks = match[1]
    const rawName = match[2]
    /* v8 ignore next -- HEADING's two capturing groups are always present on a match. */
    if (marks === undefined || rawName === undefined) continue
    const name = rawName.trim()
    if (name.length === 0) continue
    finish(marks.length)
    stack.push({ level: marks.length, node: { kind: 'heading', name, line: lineNumber }, children: [] })
  }

  finish(0)
  return roots
}
