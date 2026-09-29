/** Heuristic TypeScript / JavaScript outline from source text. */
import type { OutlineNode } from './types.ts'

const TOP_LEVEL =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s+|class\s+|interface\s+|type\s+|enum\s+|const\s+|let\s+|var\s+)/u

const FUNCTION_DECL = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/u
const CLASS_DECL = /^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/u
const INTERFACE_DECL = /^(?:export\s+)?(?:default\s+)?interface\s+([A-Za-z_$][\w$]*)/u
const TYPE_DECL = /^(?:export\s+)?(?:default\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/u
const ENUM_DECL = /^(?:export\s+)?(?:default\s+)?enum\s+([A-Za-z_$][\w$]*)/u
const CONST_FN =
  /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)/u

const METHOD =
  /^(?:(?:public|private|protected|static|abstract|override|async|readonly|get|set)\s+)*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/u
const PROPERTY =
  /^(?:(?:public|private|protected|static|abstract|override|readonly|declare)\s+)+([A-Za-z_$][\w$]*)\s*[:=]/u

/**
 * Build a TS/JS outline: top-level declarations and class members via brace depth.
 * @param text - UTF-8 source.
 * @returns outline roots.
 */
export function outlineTypeScript(text: string): OutlineNode[] {
  const lines = text.split('\n')
  const roots: OutlineNode[] = []
  let depth = 0
  const classStack: { node: OutlineNode; depth: number; children: OutlineNode[] }[] = []
  const commentState = { inBlockComment: false }

  const flushClass = (untilDepth: number): void => {
    while (classStack.length > 0) {
      const top = classStack[classStack.length - 1]
      if (top === undefined || top.depth < untilDepth) break
      classStack.pop()
      const finished: OutlineNode = top.children.length === 0
        ? { kind: top.node.kind, name: top.node.name, line: top.node.line }
        : { kind: top.node.kind, name: top.node.name, line: top.node.line, children: top.children }
      const parent = classStack[classStack.length - 1]
      if (parent === undefined) roots.push(finished)
      else parent.children.push(finished)
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (raw === undefined) continue
    const code = stripCommentsForCode(raw, commentState)
    const trimmed = code.trim()
    if (trimmed.length === 0) {
      // Comment-/whitespace-only lines never retain braces after stripping.
      depth += braceDelta(code)
      flushClass(depth)
      continue
    }

    if (depth === 0) {
      const node = matchTopLevel(trimmed, i + 1)
      if (node !== undefined) {
        if (node.kind === 'class' || node.kind === 'interface' || node.kind === 'enum') {
          classStack.push({ node, depth: 0, children: [] })
        } else {
          roots.push(node)
        }
      }
    } else if (classStack.length > 0) {
      const current = classStack[classStack.length - 1]
      if (current !== undefined && depth === current.depth + 1) {
        const nested = matchTopLevel(trimmed, i + 1)
        if (nested !== undefined && (nested.kind === 'class' || nested.kind === 'interface' || nested.kind === 'enum')) {
          classStack.push({ node: nested, depth, children: [] })
        } else {
          const member = matchMember(trimmed, i + 1)
          if (member !== undefined) current.children.push(member)
        }
      }
    }

    depth += braceDelta(code)
    if (depth < 0) depth = 0
    flushClass(depth)
  }

  flushClass(0)
  return roots
}

function matchTopLevel(line: string, lineNumber: number): OutlineNode | undefined {
  if (!TOP_LEVEL.test(line)) return undefined
  let match = FUNCTION_DECL.exec(line)
  if (match?.[1] !== undefined) return { kind: 'function', name: match[1], line: lineNumber }
  match = CLASS_DECL.exec(line)
  if (match?.[1] !== undefined) return { kind: 'class', name: match[1], line: lineNumber }
  match = INTERFACE_DECL.exec(line)
  if (match?.[1] !== undefined) return { kind: 'interface', name: match[1], line: lineNumber }
  match = TYPE_DECL.exec(line)
  if (match?.[1] !== undefined) return { kind: 'other', name: match[1], line: lineNumber }
  match = ENUM_DECL.exec(line)
  if (match?.[1] !== undefined) return { kind: 'enum', name: match[1], line: lineNumber }
  match = CONST_FN.exec(line)
  if (match?.[1] !== undefined) return { kind: 'function', name: match[1], line: lineNumber }
  return undefined
}

function matchMember(line: string, lineNumber: number): OutlineNode | undefined {
  if (line.startsWith('constructor(') || line.startsWith('constructor (')) {
    return { kind: 'method', name: 'constructor', line: lineNumber }
  }
  // Skip block keywords that look like methods.
  if (/^(?:if|for|while|switch|catch|return|throw|new|typeof|await|yield)\b/u.test(line)) return undefined
  const method = METHOD.exec(line)
  if (method?.[1] !== undefined && method[1] !== 'function' && method[1] !== 'class') {
    return { kind: 'method', name: method[1], line: lineNumber }
  }
  const property = PROPERTY.exec(line)
  if (property?.[1] !== undefined) return { kind: 'property', name: property[1], line: lineNumber }
  return undefined
}

/**
 * Count braces outside strings. Callers must strip comments first so `}` in
 * `//` or JSDoc cannot collapse nesting.
 * @param line - code with comments already removed.
 */
function braceDelta(line: string): number {
  let delta = 0
  let inString: '"' | "'" | '`' | null = null
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === undefined) break
    if (inString !== null) {
      if (ch === '\\') {
        i += 1
        continue
      }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }
    if (ch === '{') delta += 1
    else if (ch === '}') delta -= 1
  }
  return delta
}

/**
 * Remove line and block comments while preserving string contents as spaces so
 * brace positions stay aligned for multi-line block comments.
 * @param line - raw source line.
 * @param state - cross-line block-comment flag.
 * @returns the line with comment regions blanked.
 */
function stripCommentsForCode(line: string, state: { inBlockComment: boolean }): string {
  const out: string[] = []
  let inString: '"' | "'" | '`' | null = null
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === undefined) break
    if (state.inBlockComment) {
      if (ch === '*' && line[i + 1] === '/') {
        out.push(' ', ' ')
        state.inBlockComment = false
        i += 1
        continue
      }
      out.push(ch === '\t' ? '\t' : ' ')
      continue
    }
    if (inString !== null) {
      out.push(ch)
      if (ch === '\\') {
        const next = line[i + 1]
        if (next !== undefined) {
          out.push(next)
          i += 1
        }
        continue
      }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      out.push(ch)
      continue
    }
    if (ch === '/' && line[i + 1] === '/') {
      while (i < line.length) {
        out.push(' ')
        i += 1
      }
      break
    }
    if (ch === '/' && line[i + 1] === '*') {
      out.push(' ', ' ')
      state.inBlockComment = true
      i += 1
      continue
    }
    out.push(ch)
  }
  return out.join('')
}
