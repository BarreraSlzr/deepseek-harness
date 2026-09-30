/** Accessible Document Outline / Class View tree for code preview. */
import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { IconChevronDownOutline14, IconChevronRightOutline14, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DocumentOutlineView } from '../../document/contract.ts'
import type { OutlineNode } from './types.ts'
import css from './OutlinePane.module.css'

/** Labels and callbacks owned by CodeBody. */
export interface OutlinePaneProps {
  /** Nodes for the active view mode. */
  readonly nodes: readonly OutlineNode[]
  /** Whether the pane body is collapsed to a thin rail. */
  readonly collapsed: boolean
  /** Active Outline / Class View mode. */
  readonly view: DocumentOutlineView
  /** Locale-bound translate for sidebarCodePreview. */
  readonly t: TranslateNS<'sidebarCodePreview'>
  /** Toggle collapsed chrome. */
  readonly onToggleCollapsed: () => void
  /** Select Outline or Class View. @param view - presentation mode. */
  readonly onSetView: (view: DocumentOutlineView) => void
  /** Activate a symbol line. @param line - 1-based source line. */
  readonly onActivate: (line: number) => void
}

/**
 * Collapsible outline chrome with Outline / Class View pills and a keyboard tree.
 * @param props - outline tree and controls.
 */
export function OutlinePane({
  nodes, collapsed, view, t, onToggleCollapsed, onSetView, onActivate,
}: OutlinePaneProps): ReactNode {
  const labelId = useId()
  return (
    <aside
      className={clsx(css.pane, collapsed && css.collapsed)}
      data-code-outline
      data-collapsed={collapsed ? '' : undefined}
      aria-labelledby={labelId}
    >
      <div className={css.toolbar}>
        <span id={labelId} className={css.title}>{t('outline.title')}</span>
        <button
          type="button"
          className={css.collapse}
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? 'outline.expand' : 'outline.collapse')}
          data-code-outline-collapse
          onClick={onToggleCollapsed}
        >
          {collapsed
            ? <IconChevronRightOutline14 />
            : <IconChevronDownOutline14 />}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className={css.modes} role="group" aria-label={t('outline.modes')}>
            <Pill active={view === 'outline'} onClick={() => { onSetView('outline') }} data-code-outline-mode="outline">
              {t('outline.modeOutline')}
            </Pill>
            <Pill active={view === 'class'} onClick={() => { onSetView('class') }} data-code-outline-mode="class">
              {t('outline.modeClass')}
            </Pill>
          </div>
          {nodes.length === 0
            ? <p className={css.empty} data-code-outline-empty>{t('outline.empty')}</p>
            : (
              <OutlineTree
                nodes={nodes}
                label={t('outline.tree')}
                expandLabel={t('outline.expandNode')}
                collapseLabel={t('outline.collapseNode')}
                onActivate={onActivate}
              />
            )}
        </>
      )}
    </aside>
  )
}

interface OutlineTreeProps {
  readonly nodes: readonly OutlineNode[]
  readonly label: string
  readonly expandLabel: string
  readonly collapseLabel: string
  readonly onActivate: (line: number) => void
}

function OutlineTree({ nodes, label, expandLabel, collapseLabel, onActivate }: OutlineTreeProps): ReactNode {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => defaultExpanded(nodes))
  // Ids the user collapsed stay collapsed across streamed pages / view switches.
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())

  const expandNode = (id: string): void => {
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setExpanded(prev => new Set(prev).add(id))
  }

  const collapseNode = (id: string): void => {
    setCollapsedIds(prev => new Set(prev).add(id))
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // Stable kind+name+line ids survive Class View filtering; merge defaults when
  // the tree gains nodes without re-opening rows the user collapsed.
  useEffect(() => {
    setExpanded((prev) => {
      const defaults = defaultExpanded(nodes)
      let changed = false
      const next = new Set(prev)
      for (const id of defaults) {
        if (!next.has(id) && !collapsedIds.has(id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [nodes, collapsedIds])
  const flat = flatten(nodes, expanded)

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const item = target.closest<HTMLElement>('[data-outline-index]')
    if (item === null || !event.currentTarget.contains(item)) return
    const index = Number(item.dataset.outlineIndex)
    if (!Number.isFinite(index)) return
    const row = flat[index]
    if (row === undefined) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusIndex(event.currentTarget, index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusIndex(event.currentTarget, index - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate(row.node.line)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (row.hasChildren && !expanded.has(row.id)) {
        expandNode(row.id)
      } else if (row.hasChildren) {
        focusIndex(event.currentTarget, index + 1)
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (row.hasChildren && expanded.has(row.id)) {
        collapseNode(row.id)
      } else if (row.depth > 0) {
        let parentIndex = 0
        for (let i = index - 1; i >= 0; i -= 1) {
          if (flat[i]?.depth === row.depth - 1) {
            parentIndex = i
            break
          }
        }
        focusIndex(event.currentTarget, parentIndex)
      }
    }
  }

  return (
    <ul className={css.tree} role="tree" aria-label={label} data-code-outline-tree onKeyDown={onKeyDown}>
      {flat.map((row, index) => {
        const open = expanded.has(row.id)
        return (
          <li
            key={row.id}
            className={css.item}
            role="treeitem"
            tabIndex={index === 0 ? 0 : -1}
            aria-expanded={row.hasChildren ? open : undefined}
            aria-level={row.depth + 1}
            data-outline-index={index}
            data-outline-line={row.node.line}
            data-outline-kind={row.node.kind}
            style={{ '--outline-depth': row.depth } as CSSProperties}
            onClick={() => { onActivate(row.node.line) }}
          >
            {row.hasChildren
              ? (
                <button
                  type="button"
                  className={css.twist}
                  tabIndex={-1}
                  aria-label={open ? collapseLabel : expandLabel}
                  data-code-outline-twist
                  onClick={(event) => {
                    event.stopPropagation()
                    if (open) collapseNode(row.id)
                    else expandNode(row.id)
                  }}
                >
                  {open ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
                </button>
              )
              : <span className={css.twistSpacer} aria-hidden />}
            <span className={css.name}>{row.node.name}</span>
          </li>
        )
      })}
    </ul>
  )
}

interface FlatRow {
  readonly id: string
  readonly node: OutlineNode
  readonly depth: number
  readonly hasChildren: boolean
}

/** Stable across Class View filtering and streamed pages (no sibling index). */
function nodeId(node: OutlineNode): string {
  return `${node.kind}:${node.name}:${node.line}`
}

function defaultExpanded(nodes: readonly OutlineNode[]): ReadonlySet<string> {
  const ids = new Set<string>()
  const walk = (list: readonly OutlineNode[], depth: number): void => {
    for (const node of list) {
      const id = nodeId(node)
      if (node.children !== undefined && node.children.length > 0 && depth < 2) {
        ids.add(id)
        walk(node.children, depth + 1)
      }
    }
  }
  walk(nodes, 0)
  return ids
}

function flatten(nodes: readonly OutlineNode[], expanded: ReadonlySet<string>): FlatRow[] {
  const rows: FlatRow[] = []
  const walk = (list: readonly OutlineNode[], depth: number): void => {
    for (const node of list) {
      const id = nodeId(node)
      const hasChildren = node.children !== undefined && node.children.length > 0
      rows.push({ id, node, depth, hasChildren })
      if (hasChildren && node.children !== undefined && expanded.has(id)) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(nodes, 0)
  return rows
}

function focusIndex(tree: HTMLElement, index: number): void {
  const item = tree.querySelector<HTMLElement>(`[data-outline-index="${index}"]`)
  item?.focus()
}
