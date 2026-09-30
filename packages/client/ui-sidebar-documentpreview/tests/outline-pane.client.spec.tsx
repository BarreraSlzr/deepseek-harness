// @vitest-environment jsdom
/** Outline pane collapse, Class View, keyboard navigation, and streamed expand defaults. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { en } from '../src/client/code/locales.ts'
import { filterClassView } from '../src/client/code/outline/filter.ts'
import { OutlinePane } from '../src/client/code/outline/OutlinePane.tsx'
import type { OutlineNode } from '../src/client/code/outline/types.ts'
import type { DocumentOutlineView } from '../src/client/document/contract.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

const tree: OutlineNode[] = [
  { kind: 'function', name: 'helper', line: 1 },
  {
    kind: 'class', name: 'Service', line: 2,
    children: [
      { kind: 'method', name: 'run', line: 3 },
      { kind: 'property', name: 'id', line: 4 },
    ],
  },
]

function Harness({
  initial = tree,
  onActivate = vi.fn(),
}: {
  readonly initial?: readonly OutlineNode[]
  readonly onActivate?: (line: number) => void
}) {
  const [nodes, setNodes] = useState(initial)
  const [collapsed, setCollapsed] = useState(false)
  const [view, setView] = useState<DocumentOutlineView>('outline')
  const visible = view === 'class' ? filterClassView(nodes) : nodes
  return (
    <div>
      <button
        type="button"
        data-test-stream
        onClick={() => {
          setNodes([
            ...nodes,
            {
              kind: 'class', name: 'Streamed', line: 20,
              children: [{ kind: 'method', name: 'later', line: 21 }],
            },
          ])
        }}
      >
        stream
      </button>
      <OutlinePane
        nodes={visible}
        collapsed={collapsed}
        view={view}
        t={t}
        onToggleCollapsed={() => { setCollapsed(value => !value) }}
        onSetView={setView}
        onActivate={onActivate}
      />
    </div>
  )
}

describe('OutlinePane', () => {
  it('collapses to a rail and restores the tree', () => {
    const view = render(<Harness />)
    expect(view.getByRole('tree')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: 'Collapse outline' }))
    expect(view.queryByRole('tree')).toBeNull()
    expect(view.container.querySelector('[data-code-outline][data-collapsed]')).not.toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Expand outline' }))
    expect(view.getByRole('tree')).toBeTruthy()
  })

  it('shows the empty state in Class View when no classes exist', () => {
    const view = render(<Harness initial={[{ kind: 'function', name: 'only', line: 1 }]} />)
    fireEvent.click(view.getByRole('button', { name: 'Class View' }))
    expect(view.getByText('No symbols in this view.')).toBeTruthy()
  })

  it('navigates with the keyboard after focusing a twisty, and activates on Enter', () => {
    const onActivate = vi.fn()
    const view = render(<Harness onActivate={onActivate} />)
    const service = view.getByRole('treeitem', { name: /Service/ })
    const twist = service.querySelector('[data-code-outline-twist]')
    expect(twist).not.toBeNull()
    act(() => { service.focus() })
    fireEvent.keyDown(twist!, { key: 'ArrowDown' })
    const run = view.getByRole('treeitem', { name: /run/ })
    expect(document.activeElement).toBe(run)
    fireEvent.keyDown(run, { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(3)
    fireEvent.keyDown(run, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(service)
    fireEvent.keyDown(service, { key: 'ArrowLeft' })
    expect(view.queryByRole('treeitem', { name: /run/ })).toBeNull()
    fireEvent.keyDown(service, { key: 'ArrowRight' })
    expect(view.getByRole('treeitem', { name: /run/ })).toBeTruthy()
  })

  it('toggles a row with the twisty without activating the line', () => {
    const onActivate = vi.fn()
    const view = render(<Harness onActivate={onActivate} />)
    const service = view.getByRole('treeitem', { name: /Service/ })
    const twist = service.querySelector('[data-code-outline-twist]')!
    fireEvent.click(twist)
    expect(onActivate).not.toHaveBeenCalled()
    expect(view.queryByRole('treeitem', { name: /run/ })).toBeNull()
    fireEvent.click(twist)
    expect(view.getByRole('treeitem', { name: /run/ })).toBeTruthy()
  })

  it('default-expands newly streamed class nodes using stable ids', async () => {
    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'stream' }))
    await waitFor(() => {
      expect(view.getByRole('treeitem', { name: /Streamed/ })).toBeTruthy()
      expect(view.getByRole('treeitem', { name: /later/ })).toBeTruthy()
    })
  })

  it('keeps a manually collapsed row collapsed across streamed pages', async () => {
    const view = render(<Harness />)
    const service = view.getByRole('treeitem', { name: /Service/ })
    const twist = service.querySelector('[data-code-outline-twist]')!
    fireEvent.click(twist)
    expect(view.queryByRole('treeitem', { name: /run/ })).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'stream' }))
    await waitFor(() => {
      expect(view.getByRole('treeitem', { name: /Streamed/ })).toBeTruthy()
      expect(view.getByRole('treeitem', { name: /later/ })).toBeTruthy()
    })
    expect(view.queryByRole('treeitem', { name: /run/ })).toBeNull()
  })

  it('activates a leaf row on click and Space', () => {
    const onActivate = vi.fn()
    const view = render(<Harness onActivate={onActivate} />)
    const helper = view.getByRole('treeitem', { name: /helper/ })
    fireEvent.click(helper)
    expect(onActivate).toHaveBeenCalledWith(1)
    fireEvent.keyDown(helper, { key: ' ' })
    expect(onActivate).toHaveBeenCalledTimes(2)
  })

  it('switches back to Outline, expands an already-open row with ArrowRight, and focuses parents with ArrowLeft', () => {
    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'Class View' }))
    fireEvent.click(view.getByRole('button', { name: /^Outline$/ }))
    expect(view.getByRole('treeitem', { name: /helper/ })).toBeTruthy()
    const service = view.getByRole('treeitem', { name: /Service/ })
    fireEvent.keyDown(service, { key: 'ArrowRight' })
    const run = view.getByRole('treeitem', { name: /run/ })
    expect(document.activeElement).toBe(run)
    fireEvent.keyDown(run, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(service)
    const id = view.getByRole('treeitem', { name: /id/ })
    fireEvent.keyDown(id, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(service)
  })

  it('expands a never-collapsed deep row with ArrowRight without touching collapsedIds', () => {
    const deep: OutlineNode[] = [{
      kind: 'class', name: 'Outer', line: 1,
      children: [{
        kind: 'class', name: 'Mid', line: 2,
        children: [{
          kind: 'class', name: 'Leaf', line: 3,
          children: [{ kind: 'method', name: 'go', line: 4 }],
        }],
      }],
    }]
    const view = render(<Harness initial={deep} />)
    expect(view.queryByRole('treeitem', { name: /go/ })).toBeNull()
    const leaf = view.getByRole('treeitem', { name: /Leaf/ })
    fireEvent.keyDown(leaf, { key: 'ArrowRight' })
    expect(view.getByRole('treeitem', { name: /go/ })).toBeTruthy()
  })

  it('ignores ArrowRight on leaves and ArrowLeft on roots without collapsing', () => {
    const view = render(<Harness />)
    const helper = view.getByRole('treeitem', { name: /helper/ })
    act(() => { helper.focus() })
    fireEvent.keyDown(helper, { key: 'ArrowRight' })
    fireEvent.keyDown(helper, { key: 'ArrowLeft' })
    fireEvent.keyDown(helper, { key: 'Escape' })
    expect(document.activeElement).toBe(helper)
    expect(view.getByRole('treeitem', { name: /Service/ })).toBeTruthy()
  })

  it('ignores key events that are not on a treeitem', () => {
    const onActivate = vi.fn()
    const view = render(<Harness onActivate={onActivate} />)
    const tree = view.getByRole('tree')
    fireEvent.keyDown(tree, { key: 'Enter' })
    expect(onActivate).not.toHaveBeenCalled()

    const service = view.getByRole('treeitem', { name: /Service/ })
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    service.appendChild(svg)
    fireEvent.keyDown(svg, { key: 'Enter' })
    expect(onActivate).not.toHaveBeenCalled()

    service.setAttribute('data-outline-index', 'not-a-number')
    fireEvent.keyDown(service, { key: 'Enter' })
    expect(onActivate).not.toHaveBeenCalled()

    service.setAttribute('data-outline-index', '999')
    fireEvent.keyDown(service, { key: 'Enter' })
    expect(onActivate).not.toHaveBeenCalled()
  })
})
