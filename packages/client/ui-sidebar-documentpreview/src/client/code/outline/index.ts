/**
 * Build a structural Document Outline for code preview from path + text.
 * Heuristic scanners only; languages without a scanner yield an empty tree.
 */
import { languageForPath } from '../languages.ts'
import type { DocumentOutlineView } from '../../document/contract.ts'
import { capOutline, filterClassView } from './filter.ts'
import { outlineJson } from './json.ts'
import { outlineMarkdown } from './markdown.ts'
import { outlinePython } from './python.ts'
import type { OutlineNode } from './types.ts'
import { outlineTypeScript } from './typescript.ts'
import { outlineYaml } from './yaml.ts'

export type { OutlineKind, OutlineNode } from './types.ts'
export { MAX_OUTLINE_DEPTH, MAX_OUTLINE_NODES, CLASS_VIEW_KINDS } from './types.ts'
export { filterClassView, capOutline, isClassViewRoot } from './filter.ts'
export type { DocumentOutlineView as OutlineViewMode } from '../../document/contract.ts'

/**
 * Build the Document Outline tree for a file path and its loaded text.
 * @param path - decoded workspace or absolute path (extension selects the scanner).
 * @param text - accumulated UTF-8 preview text.
 * @returns capped outline roots; empty when unsupported or unstructured.
 */
export function buildOutline(path: string, text: string): OutlineNode[] {
  if (text.length === 0) return []
  const language = languageForPath(path)
  if (language === undefined) return []
  const raw = scan(language, text)
  return capOutline(raw)
}

/**
 * Select nodes for the active outline view mode.
 * @param nodes - full Document Outline from {@link buildOutline}.
 * @param mode - Outline or Class View.
 * @returns nodes to render in the tree.
 */
export function outlineForView(nodes: readonly OutlineNode[], mode: DocumentOutlineView): OutlineNode[] {
  return mode === 'class' ? filterClassView(nodes) : [...nodes]
}

function scan(language: string, text: string): OutlineNode[] {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return outlineTypeScript(text)
    case 'python':
      return outlinePython(text)
    case 'markdown':
    case 'mdx':
      return outlineMarkdown(text)
    case 'json':
      return outlineJson(text)
    case 'yaml':
      return outlineYaml(text)
    default:
      return []
  }
}
