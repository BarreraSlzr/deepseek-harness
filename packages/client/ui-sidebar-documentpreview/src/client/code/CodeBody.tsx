/** Incrementally highlighted source with an optional Document Outline / Class View pane. */
import { useCallback, useMemo, useRef, type ReactNode, type RefCallback } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { DocumentPreviewProps } from '../document/contract.ts'
import { scrollToLine } from '../text/lines.ts'
import { languageForPath } from './languages.ts'
import type {} from './locales.ts'
import { buildOutline, outlineForView } from './outline/index.ts'
import { OutlinePane } from './outline/OutlinePane.tsx'
import css from './CodeBody.module.css'

/** Document owner props and this renderer's localized controls. */
export type CodeBodyProps = DocumentPreviewProps & PropsLocale<'sidebarCodePreview'>

/** @param props - accumulated document contents and framework props. @returns one stable CodeBlock, or no body for byte contents. */
export function CodeBody({
  resourceAddress, content, wrap, scrollportRef,
  outlineCollapsed = false,
  outlineView = 'outline',
  onToggleOutlineCollapsed,
  onSetOutlineView,
  t,
}: CodeBodyProps): ReactNode {
  const file = content.kind === 'text' ? parseFileAddress(resourceAddress) : undefined
  if (content.kind === 'text' && file === undefined) {
    throw new Error(`ui-sidebar-documentpreview: not a file address "${resourceAddress}"`)
  }
  const path = file?.path ?? ''
  const text = content.kind === 'text' ? content.text : ''
  const outline = useMemo(
    () => content.kind === 'text' ? buildOutline(path, text) : [],
    [content.kind, path, text],
  )
  const visible = useMemo(() => outlineForView(outline, outlineView), [outline, outlineView])
  const codePortRef = useRef<HTMLElement | null>(null)
  const bindCodePort = useCallback<RefCallback<HTMLElement>>((element) => {
    codePortRef.current = element
    scrollportRef?.(element)
  }, [scrollportRef])
  const activate = useCallback((line: number) => {
    const port = codePortRef.current
    if (port !== null) scrollToLine(port, line)
  }, [])
  const toggleCollapsed = useCallback(() => {
    onToggleOutlineCollapsed?.()
  }, [onToggleOutlineCollapsed])
  const setView = useCallback((view: typeof outlineView) => {
    onSetOutlineView?.(view)
  }, [onSetOutlineView])

  if (content.kind !== 'text' || file === undefined) return null
  const language = languageForPath(file.path)

  return (
    <div className={css.renderer} data-code-preview data-wrap={wrap}>
      {outline.length > 0 && (
        <OutlinePane
          nodes={visible}
          collapsed={outlineCollapsed}
          view={outlineView}
          t={t}
          onToggleCollapsed={toggleCollapsed}
          onSetView={setView}
          onActivate={activate}
        />
      )}
      <div className={css.codeColumn}>
        <CodeBlock
          className={css.code}
          contentRef={bindCodePort}
          code={content.text}
          lang={language}
          streaming={!content.eof}
          lineNumbers
          copyLabel={t('copy')}
          copiedLabel={t('copied')}
        />
      </div>
    </div>
  )
}
