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

/** Keywords after which `/` starts a regex literal, not division. */
const REGEX_AFTER_KEYWORD = new Set([
  'return', 'case', 'throw', 'typeof', 'delete', 'void', 'await', 'new', 'yield', 'in', 'of', 'instanceof',
])

/** Cross-line scan state for comments and template literals. */
interface ScanState {
  inBlockComment: boolean
  /** Inside a `` `...` `` template (possibly spanning lines). */
  inTemplate: boolean
  /**
   * Brace depth inside a `${ ... }` interpolation. Zero means template text
   * (braces are literal); greater than zero means real code braces count.
   */
  templateExprDepth: number
}

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
  const scanState: ScanState = { inBlockComment: false, inTemplate: false, templateExprDepth: 0 }

  const flushClass = (untilDepth: number): void => {
    while (true) {
      const top = classStack.at(-1)
      if (top === undefined || top.depth < untilDepth) break
      classStack.pop()
      const finished: OutlineNode = top.children.length === 0
        ? { kind: top.node.kind, name: top.node.name, line: top.node.line }
        : { kind: top.node.kind, name: top.node.name, line: top.node.line, children: top.children }
      const parent = classStack.at(-1)
      if (parent === undefined) roots.push(finished)
      else parent.children.push(finished)
    }
  }

  let lineNumber = 0
  for (const raw of lines) {
    lineNumber += 1
    const code = normalizeLineForBraces(raw, scanState)
    const trimmed = code.trim()
    if (trimmed.length === 0) {
      depth += braceDelta(code)
      flushClass(depth)
      continue
    }

    if (depth === 0) {
      const node = matchTopLevel(trimmed, lineNumber)
      if (node !== undefined) {
        if (node.kind === 'class' || node.kind === 'interface' || node.kind === 'enum') {
          classStack.push({ node, depth: 0, children: [] })
        } else {
          roots.push(node)
        }
      }
    } else {
      const current = classStack.at(-1)
      if (current !== undefined && depth === current.depth + 1) {
        const nested = matchTopLevel(trimmed, lineNumber)
        if (nested !== undefined && (nested.kind === 'class' || nested.kind === 'interface' || nested.kind === 'enum')) {
          classStack.push({ node: nested, depth, children: [] })
        } else {
          const member = matchMember(trimmed, lineNumber)
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
 * Count braces on a line already normalized so strings, regexes, comments, and
 * template text contribute no `{` / `}`.
 * @param line - normalized code line.
 */
function braceDelta(line: string): number {
  let delta = 0
  for (const ch of line) {
    if (ch === '{') delta += 1
    else if (ch === '}') delta -= 1
  }
  return delta
}

/**
 * Blank comments, string/regex bodies, and template text so brace counting sees
 * only structural code (including `${ ... }` interpolations).
 * @param line - raw source line.
 * @param state - cross-line comment / template state.
 * @returns line with non-code regions replaced by spaces.
 */
function normalizeLineForBraces(line: string, state: ScanState): string {
  const out: string[] = []
  let inString: '"' | "'" | null = null
  let inRegex = false
  let escape = false
  /** Last significant code character — decides whether `/` starts a regex. */
  let prevCode = ''
  /** Identifier/keyword just completed before whitespace or punctuator. */
  let prevWord = ''
  let word = ''

  const blank = (ch: string): void => {
    out.push(ch === '\t' ? '\t' : ' ')
  }

  const endWord = (): void => {
    if (word.length > 0) {
      prevWord = word
      word = ''
    }
  }

  const emitCode = (ch: string): void => {
    out.push(ch)
    if (ch === ' ' || ch === '\t') {
      endWord()
      return
    }
    if (/[A-Za-z_$0-9]/u.test(ch)) {
      word += ch
      prevCode = ch
      return
    }
    endWord()
    prevCode = ch
    prevWord = ''
  }

  for (let i = 0; i < line.length; i += 1) {
    const ch = line.charAt(i)
    const next = line.charAt(i + 1)

    if (state.inBlockComment) {
      if (ch === '*' && next === '/') {
        blank(ch)
        blank(next)
        state.inBlockComment = false
        i += 1
        continue
      }
      blank(ch)
      continue
    }

    // Template literal text (not inside `${}`): braces are literal content.
    if (state.inTemplate && state.templateExprDepth === 0) {
      if (escape) {
        blank(ch)
        escape = false
        continue
      }
      if (ch === '\\') {
        blank(ch)
        escape = true
        continue
      }
      if (ch === '`') {
        blank(ch)
        state.inTemplate = false
        prevCode = '`'
        prevWord = ''
        continue
      }
      if (ch === '$' && next === '{') {
        blank(ch)
        endWord()
        emitCode('{')
        state.templateExprDepth = 1
        i += 1
        continue
      }
      blank(ch)
      continue
    }

    if (inString !== null) {
      blank(ch)
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === inString) {
        inString = null
        prevCode = ch
        prevWord = ''
      }
      continue
    }

    if (inRegex) {
      blank(ch)
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '/') {
        inRegex = false
        prevCode = '/'
        prevWord = ''
        while (i + 1 < line.length && /[a-z]/iu.test(line.charAt(i + 1))) {
          i += 1
          blank(line.charAt(i))
        }
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      endWord()
      inString = ch
      blank(ch)
      continue
    }

    if (ch === '`') {
      endWord()
      if (state.templateExprDepth > 0) {
        // Nested template inside `${...}`: blank through its closer on this line.
        blank(ch)
        let nestedEscape = false
        while (i + 1 < line.length) {
          i += 1
          const nested = line.charAt(i)
          blank(nested)
          if (nestedEscape) {
            nestedEscape = false
            continue
          }
          if (nested === '\\') {
            nestedEscape = true
            continue
          }
          if (nested === '`') break
        }
        continue
      }
      state.inTemplate = true
      state.templateExprDepth = 0
      blank(ch)
      continue
    }

    if (ch === '/' && next === '/') {
      endWord()
      while (i < line.length) {
        blank(line.charAt(i))
        i += 1
      }
      break
    }
    if (ch === '/' && next === '*') {
      endWord()
      blank(ch)
      blank(next)
      state.inBlockComment = true
      i += 1
      continue
    }
    if (ch === '/' && next !== '=' && canStartRegex(prevCode, prevWord)) {
      endWord()
      inRegex = true
      blank(ch)
      continue
    }

    if (state.templateExprDepth > 0) {
      if (ch === '{') {
        state.templateExprDepth += 1
        emitCode(ch)
        continue
      }
      if (ch === '}') {
        state.templateExprDepth -= 1
        emitCode(ch)
        // Returning to template text after the interpolation's closing brace.
        if (state.templateExprDepth === 0) state.inTemplate = true
        continue
      }
    }

    emitCode(ch)
  }

  endWord()
  return out.join('')
}

/**
 * Whether `/` may open a regex literal (vs division) given prior code context.
 * @param prev - last significant code character, or empty at line start.
 * @param prevWord - last completed identifier/keyword before punctuator/space.
 */
function canStartRegex(prev: string, prevWord: string): boolean {
  if (prev.length === 0) return true
  if ('({[%=!&|?:;,+-~^<>*'.includes(prev)) return true
  return REGEX_AFTER_KEYWORD.has(prevWord)
}
