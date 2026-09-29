/** Class View filter and outline tree capping helpers. */
import { MAX_OUTLINE_DEPTH, MAX_OUTLINE_NODES, type OutlineKind, type OutlineNode } from './types.ts'

/**
 * Keep class/interface/enum nodes and their nested methods/properties.
 * Non-class containers are descended so nested types still appear.
 * @param nodes - full Document Outline tree.
 * @returns Class View tree, or empty when nothing qualifies.
 */
export function filterClassView(nodes: readonly OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = []
  for (const node of nodes) {
    if (isClassViewRoot(node.kind)) {
      const children = node.children === undefined ? undefined : filterClassMembers(node.children)
      out.push(leafOrWithChildren(node, children))
      continue
    }
    if (node.children !== undefined) out.push(...filterClassView(node.children))
  }
  return out
}

/**
 * Keep methods, properties, and nested class-like types under a class root.
 * @param nodes - children of a class/interface/enum.
 */
function filterClassMembers(nodes: readonly OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = []
  for (const node of nodes) {
    if (node.kind === 'method' || node.kind === 'property') {
      out.push({ kind: node.kind, name: node.name, line: node.line })
      continue
    }
    if (isClassViewRoot(node.kind)) {
      out.push(...filterClassView([node]))
      continue
    }
    if (node.children !== undefined) out.push(...filterClassMembers(node.children))
  }
  return out
}

/**
 * Truncate a tree to the global node and depth caps.
 * @param nodes - scanner output.
 * @returns capped copy; original nodes are not mutated.
 */
export function capOutline(nodes: readonly OutlineNode[]): OutlineNode[] {
  let remaining = MAX_OUTLINE_NODES
  const visit = (list: readonly OutlineNode[], depth: number): OutlineNode[] => {
    if (remaining <= 0) return []
    const out: OutlineNode[] = []
    for (const node of list) {
      if (remaining <= 0) break
      remaining -= 1
      const children = node.children === undefined || depth >= MAX_OUTLINE_DEPTH
        ? undefined
        : visit(node.children, depth + 1)
      out.push(leafOrWithChildren(node, children))
    }
    return out
  }
  return visit(nodes, 1)
}

/**
 * Whether a kind is a Class View container root.
 * @param kind - outline kind.
 */
export function isClassViewRoot(kind: OutlineKind): boolean {
  return kind === 'class' || kind === 'interface' || kind === 'enum'
}

function leafOrWithChildren(node: OutlineNode, children: readonly OutlineNode[] | undefined): OutlineNode {
  return children === undefined || children.length === 0
    ? { kind: node.kind, name: node.name, line: node.line }
    : { kind: node.kind, name: node.name, line: node.line, children }
}
