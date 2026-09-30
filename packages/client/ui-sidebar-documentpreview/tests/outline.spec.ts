/** Unit tests for structural outline builders and Class View filtering. */
import { describe, expect, it } from 'vitest'
import {
  buildOutline,
  capOutline,
  filterClassView,
  MAX_OUTLINE_NODES,
  MAX_OUTLINE_DEPTH,
  outlineForView,
} from '../src/client/code/outline/index.ts'
import type { OutlineNode } from '../src/client/code/outline/types.ts'
import { outlineTypeScript } from '../src/client/code/outline/typescript.ts'
import { outlinePython } from '../src/client/code/outline/python.ts'
import { outlineMarkdown } from '../src/client/code/outline/markdown.ts'
import { outlineJson } from '../src/client/code/outline/json.ts'
import { outlineYaml } from '../src/client/code/outline/yaml.ts'

describe('outlineTypeScript', () => {
  it('collects top-level declarations and class methods', () => {
    const text = [
      'export function helper() {}',
      'export class Service {',
      '  constructor() {}',
      '  async run(): Promise<void> {}',
      '  readonly id: string',
      '}',
      'export interface Options {',
      '  flag: boolean',
      '}',
      'export enum Kind { A, B }',
      'const load = async () => {}',
      'type Alias = string',
    ].join('\n')

    expect(outlineTypeScript(text)).toEqual([
      { kind: 'function', name: 'helper', line: 1 },
      {
        kind: 'class', name: 'Service', line: 2,
        children: [
          { kind: 'method', name: 'constructor', line: 3 },
          { kind: 'method', name: 'run', line: 4 },
          { kind: 'property', name: 'id', line: 5 },
        ],
      },
      { kind: 'interface', name: 'Options', line: 7 },
      { kind: 'enum', name: 'Kind', line: 10 },
      { kind: 'function', name: 'load', line: 11 },
      { kind: 'other', name: 'Alias', line: 12 },
    ])
  })

  it('ignores braces inside line and block comments', () => {
    const text = [
      'export class Service {',
      '  // closing brace in comment }',
      '  /**',
      '   * JSDoc with } should not collapse',
      '   */',
      '  run() {}',
      '}',
      'export function after() {}',
    ].join('\n')
    expect(outlineTypeScript(text)).toEqual([
      {
        kind: 'class', name: 'Service', line: 1,
        children: [{ kind: 'method', name: 'run', line: 6 }],
      },
      { kind: 'function', name: 'after', line: 8 },
    ])
  })

  it('ignores braces inside strings and skips block-control keywords as methods', () => {
    const text = [
      'export class Service {',
      '  label = "has { and } chars"',
      '  escaped = "a\\\\b"',
      '  if (true) {}',
      '  run() {',
      '    if (true) { return 1 }',
      '  }',
      '}',
      '{',
      '  const orphan = 1',
      '}',
    ].join('\n')
    expect(outlineTypeScript(text)).toEqual([
      {
        kind: 'class', name: 'Service', line: 1,
        children: [{ kind: 'method', name: 'run', line: 5 }],
      },
    ])
  })

  it('nests inner classes onto their parent and tolerates stray closers', () => {
    const text = [
      'export class Outer {',
      '  class Inner {',
      '    go() {}',
      '  }',
      '  interface Opts {}',
      '  enum Kind { A }',
      '}',
      '}',
      'export const bare = 1',
      '  function()',
      '  class()',
    ].join('\n')
    expect(outlineTypeScript(text)).toEqual([
      {
        kind: 'class', name: 'Outer', line: 1,
        children: [
          {
            kind: 'class', name: 'Inner', line: 2,
            children: [{ kind: 'method', name: 'go', line: 3 }],
          },
          { kind: 'interface', name: 'Opts', line: 5 },
          { kind: 'enum', name: 'Kind', line: 6 },
        ],
      },
    ])
  })

  it('strips escaped quotes and tabs inside comments without losing the following symbol', () => {
    const text = [
      'export class Service {',
      '  /*\t comment */',
      '  msg = "say \\"hi\\""',
      '  trailing = "ends\\\\"',
      '  dangling = "abc\\',
      '  ok() {}',
      '}',
    ].join('\n')
    expect(outlineTypeScript(text).map(n => n.name)).toEqual(['Service'])
    expect(outlineTypeScript(text)[0]?.children?.map(n => n.name)).toEqual(['ok'])
  })

  it('ignores braces inside regex literals and multi-line templates', () => {
    const text = [
      '/\\{/',
      'const re = /\\{/gi',
      'const page = `',
      'brace \\{ still template',
      '{ not a scope',
      '`',
      'export class Service {',
      '  run() {}',
      '}',
      'const after = /}/',
      'return /x/',
      'export function keep() {}',
    ].join('\n')
    expect(outlineTypeScript(text)).toEqual([
      {
        kind: 'class', name: 'Service', line: 7,
        children: [{ kind: 'method', name: 'run', line: 8 }],
      },
      { kind: 'function', name: 'keep', line: 12 },
    ])
  })

  it('counts braces inside template interpolations and blanks nested templates', () => {
    const text = [
      'const label = `x ${foo({ a: 1 })} y`',
      'const nested = `outer ${`inner \\` tick`} z`',
      'export class Service {',
      '  run() {}',
      '}',
    ].join('\n')
    expect(outlineTypeScript(text).map(n => n.name)).toEqual(['Service'])
  })
})

describe('outlinePython', () => {
  it('nests methods under classes by indentation', () => {
    const text = [
      'def top():',
      '    pass',
      'class Thing:',
      '    def method(self):',
      '        pass',
      '    def other(self):',
      '        pass',
    ].join('\n')

    expect(outlinePython(text)).toEqual([
      { kind: 'function', name: 'top', line: 1 },
      {
        kind: 'class', name: 'Thing', line: 3,
        children: [
          { kind: 'method', name: 'method', line: 4 },
          { kind: 'method', name: 'other', line: 6 },
        ],
      },
    ])
  })
})

describe('outlineMarkdown', () => {
  it('nests headings by level', () => {
    const text = [
      '# Title',
      '## Section',
      '### Detail',
      '## Other',
      '#    ',
    ].join('\n')

    expect(outlineMarkdown(text)).toEqual([
      {
        kind: 'heading', name: 'Title', line: 1,
        children: [
          {
            kind: 'heading', name: 'Section', line: 2,
            children: [{ kind: 'heading', name: 'Detail', line: 3 }],
          },
          { kind: 'heading', name: 'Other', line: 4 },
        ],
      },
    ])
  })

  it('skips ATX-looking lines inside fenced code blocks', () => {
    const text = [
      '# Title',
      '```bash',
      '# install deps',
      'pnpm install',
      '```',
      '## Section',
      '~~~',
      '# not a heading',
      '~~~',
    ].join('\n')
    expect(outlineMarkdown(text)).toEqual([
      {
        kind: 'heading', name: 'Title', line: 1,
        children: [{ kind: 'heading', name: 'Section', line: 6 }],
      },
    ])
  })
})

describe('outlineJson', () => {
  it('lists top-level object keys with source lines', () => {
    const text = '{\n  "alpha": 1,\n  "beta": 2\n}\n'
    expect(outlineJson(text)).toEqual([
      { kind: 'property', name: 'alpha', line: 2 },
      { kind: 'property', name: 'beta', line: 3 },
    ])
  })

  it('falls back when a key colon is on the next line', () => {
    const text = '{\n  "alpha"\n  : 1\n}\n'
    expect(outlineJson(text)).toEqual([
      { kind: 'property', name: 'alpha', line: 2 },
    ])
  })

  it('accepts spaces between a key and its colon', () => {
    expect(outlineJson('{ \"alpha\"  : 1 }')).toEqual([
      { kind: 'property', name: 'alpha', line: 1 },
    ])
  })

  it('keeps the first line for duplicate object keys', () => {
    expect(outlineJson('{\n  "a": 1,\n  "a": 2\n}')).toEqual([
      { kind: 'property', name: 'a', line: 2 },
    ])
  })

  it('handles escaped quotes inside keys and string array elements', () => {
    expect(outlineJson('{ "say \\"hi\\"": 1 }').map(n => n.name)).toEqual(['say "hi"'])
    expect(outlineJson('[ "a\\\\b", 2 ]')).toEqual([
      { kind: 'section', name: '[0]', line: 1 },
      { kind: 'section', name: '[1]', line: 1 },
    ])
  })

  it('lists top-level array elements on their true start lines', () => {
    const text = '[\n  1,\n  {\n    "nested": true\n  },\n  "tail"\n]\n'
    expect(outlineJson(text)).toEqual([
      { kind: 'section', name: '[0]', line: 2 },
      { kind: 'section', name: '[1]', line: 3 },
      { kind: 'section', name: '[2]', line: 6 },
    ])
  })

  it('handles compact arrays without collapsing every index to line 1', () => {
    expect(outlineJson('[1, 2, 3]')).toEqual([
      { kind: 'section', name: '[0]', line: 1 },
      { kind: 'section', name: '[1]', line: 1 },
      { kind: 'section', name: '[2]', line: 1 },
    ])
  })

  it('returns empty for invalid JSON and non-container values', () => {
    expect(outlineJson('{')).toEqual([])
    expect(outlineJson('42')).toEqual([])
    expect(outlineJson('"plain"')).toEqual([])
  })

  it('indexes only top-level keys, not nested ones', () => {
    const text = '{\n  "outer": {\n    "inner": 1\n  }\n}\n'
    expect(outlineJson(text)).toEqual([
      { kind: 'property', name: 'outer', line: 2 },
    ])
  })
})

describe('outlineYaml', () => {
  it('lists column-0 mapping keys', () => {
    const text = [
      '---',
      'name: demo',
      'nested:',
      '  child: 1',
      '# comment',
      '',
      '\tindented: skip',
      'list:',
      '  - a',
      '- notakey',
      '...',
    ].join('\n')
    expect(outlineYaml(text)).toEqual([
      { kind: 'property', name: 'name', line: 2 },
      { kind: 'property', name: 'nested', line: 3 },
      { kind: 'property', name: 'list', line: 8 },
    ])
  })
})

describe('buildOutline', () => {
  it('selects the scanner from the file path', () => {
    expect(buildOutline('src/a.ts', 'export function go() {}\n').map(n => n.name)).toEqual(['go'])
    expect(buildOutline('src/a.js', 'function go() {}\n').map(n => n.name)).toEqual(['go'])
    expect(buildOutline('readme.md', '# Hello\n').map(n => n.name)).toEqual(['Hello'])
    expect(buildOutline('notes.mdx', '# Hello\n').map(n => n.name)).toEqual(['Hello'])
    expect(buildOutline('main.py', 'def go():\n  pass\n').map(n => n.name)).toEqual(['go'])
    expect(buildOutline('data.json', '{"a":1}\n').map(n => n.name)).toEqual(['a'])
    expect(buildOutline('cfg.yaml', 'a: 1\n').map(n => n.name)).toEqual(['a'])
    expect(buildOutline('cfg.yml', 'a: 1\n').map(n => n.name)).toEqual(['a'])
    expect(buildOutline('notes.txt', 'export function go() {}\n')).toEqual([])
    expect(buildOutline('src/a.ts', '')).toEqual([])
    expect(buildOutline('styles.css', 'body {}\n')).toEqual([])
  })

  it('caps oversized trees and deep nesting', () => {
    const nodes: OutlineNode[] = Array.from({ length: MAX_OUTLINE_NODES + 20 }, (_, i) => ({
      kind: 'function' as const, name: `f${i}`, line: i + 1,
    }))
    expect(capOutline(nodes)).toHaveLength(MAX_OUTLINE_NODES)

    let deep: OutlineNode = { kind: 'function', name: 'leaf', line: 99 }
    for (let depth = 0; depth < 12; depth += 1) {
      deep = { kind: 'class', name: `c${depth}`, line: depth + 1, children: [deep] }
    }
    const capped = capOutline([deep])
    let walk: OutlineNode | undefined = capped[0]
    let levels = 0
    while (walk !== undefined) {
      levels += 1
      walk = walk.children?.[0]
    }
    expect(levels).toBeLessThanOrEqual(MAX_OUTLINE_DEPTH)
  })
})

describe('filterClassView / outlineForView', () => {
  it('keeps classes and their members, dropping free functions', () => {
    const nodes: OutlineNode[] = [
      { kind: 'function', name: 'helper', line: 1 },
      {
        kind: 'class', name: 'Service', line: 2,
        children: [
          { kind: 'method', name: 'run', line: 3 },
          { kind: 'property', name: 'id', line: 4 },
          {
            kind: 'class', name: 'Nested', line: 5,
            children: [{ kind: 'method', name: 'inner', line: 6 }],
          },
          {
            kind: 'section', name: 'group', line: 7,
            children: [{ kind: 'method', name: 'grouped', line: 8 }],
          },
          { kind: 'section', name: 'empty', line: 9 },
        ],
      },
      {
        kind: 'heading', name: 'Docs', line: 10,
        children: [{ kind: 'class', name: 'Promoted', line: 11 }],
      },
    ]
    expect(filterClassView(nodes)).toEqual([
      {
        kind: 'class', name: 'Service', line: 2,
        children: [
          { kind: 'method', name: 'run', line: 3 },
          { kind: 'property', name: 'id', line: 4 },
          {
            kind: 'class', name: 'Nested', line: 5,
            children: [{ kind: 'method', name: 'inner', line: 6 }],
          },
          { kind: 'method', name: 'grouped', line: 8 },
        ],
      },
      { kind: 'class', name: 'Promoted', line: 11 },
    ])
    expect(outlineForView(nodes, 'outline')).toEqual(nodes)
    expect(outlineForView(nodes, 'class')).toEqual(filterClassView(nodes))
  })

  it('stops descending children once the node budget is exhausted', () => {
    const children: OutlineNode[] = Array.from({ length: 3 }, (_, i) => ({
      kind: 'method' as const, name: `m${i}`, line: i + 2,
    }))
    const nodes: OutlineNode[] = Array.from({ length: MAX_OUTLINE_NODES }, (_, i) => ({
      kind: 'class' as const,
      name: `C${i}`,
      line: i + 1,
      children: i === MAX_OUTLINE_NODES - 1 ? children : undefined,
    }))
    const capped = capOutline(nodes)
    expect(capped).toHaveLength(MAX_OUTLINE_NODES)
    expect(capped.at(-1)?.children).toBeUndefined()
  })
})
