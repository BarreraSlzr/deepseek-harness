/** Locale-owned code renderer name, CodeBlock controls, and outline pane. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Code document implementation name and copy controls. */
    sidebarCodePreview: keyof typeof zh
  }
}

/** Simplified Chinese dictionary and key source. */
export const zh = {
  title: '代码',
  copy: '复制',
  copied: '已复制',
  'outline.title': '大纲',
  'outline.modes': '大纲视图',
  'outline.modeOutline': '文档大纲',
  'outline.modeClass': '类视图',
  'outline.empty': '当前视图没有符号。',
  'outline.tree': '文档大纲',
  'outline.collapse': '折叠大纲',
  'outline.expand': '展开大纲',
  'outline.expandNode': '展开',
  'outline.collapseNode': '折叠',
}

/** English dictionary with the same keys. */
export const en = {
  title: 'Code',
  copy: 'Copy',
  copied: 'Copied',
  'outline.title': 'Outline',
  'outline.modes': 'Outline views',
  'outline.modeOutline': 'Outline',
  'outline.modeClass': 'Class View',
  'outline.empty': 'No symbols in this view.',
  'outline.tree': 'Document outline',
  'outline.collapse': 'Collapse outline',
  'outline.expand': 'Expand outline',
  'outline.expandNode': 'Expand',
  'outline.collapseNode': 'Collapse',
} satisfies Record<keyof typeof zh, string>
