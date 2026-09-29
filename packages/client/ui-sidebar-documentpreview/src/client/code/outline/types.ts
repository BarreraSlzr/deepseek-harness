/**
 * Structural outline nodes for code preview navigation.
 * Heuristic parsers produce these trees; they are presentation-only.
 */

/** Closed set of outline entry kinds shown in Document Outline / Class View. */
export type OutlineKind =
  | 'file'
  | 'class'
  | 'interface'
  | 'enum'
  | 'function'
  | 'method'
  | 'property'
  | 'heading'
  | 'section'
  | 'other'

/** One outline entry with an optional nested tree. Lines are 1-based source lines. */
export interface OutlineNode {
  /** Presentation kind for icons and Class View filtering. */
  readonly kind: OutlineKind
  /** Display name (symbol, heading text, or key). */
  readonly name: string
  /** 1-based first line of the symbol or heading. */
  readonly line: number
  /** Nested children when the scanner builds a hierarchy. */
  readonly children?: readonly OutlineNode[]
}

/** Hard caps so large files stay interactive. */
export const MAX_OUTLINE_NODES = 500
/** Maximum nesting depth retained from scanners. */
export const MAX_OUTLINE_DEPTH = 8

/** Kinds retained (with nested methods/properties) in Class View. */
export const CLASS_VIEW_KINDS: ReadonlySet<OutlineKind> = new Set([
  'class',
  'interface',
  'enum',
  'method',
  'property',
])
