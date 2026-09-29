# Agent Note: 代码预览的本地文档大纲

Status: implemented

[English](2026-09-28-local-code-preview-document-outline.md) | 中文

## Problem

代码预览已经能高亮源码并跳到 1 起算行号，但读者仍无法像 IDE 的文档大纲或类视图那样浏览文件结构。若先扩展封闭的 LSP seam 加入 `documentSymbol`、增加面向模型的大纲工具，或用实验性高亮器替换 Shiki，都会改动另一套产品契约。首个交付路径需要在不承担这些成本的前提下改善预览导航。

## Decision

代码预览（`ui-sidebar-documentpreview` 的 code body）用按语言的启发式扫描器，从已累积文本构建仅用于呈现的大纲（TypeScript/JavaScript、Python、Markdown/MDX、JSON、YAML）。窗格提供文档大纲与类视图，可折叠在源码旁，并通过现有 `scrollToLine` 路径激活行。折叠与视图模式保存在该 tab 的预览 `TextStore`。不支持的语言与空扫描结果隐藏窗格。大纲永不进入 Session 日志或模型请求。高亮仍用 Shiki；不采用 `gpu-lexer` 与 `react-aria-components`。LSP `documentSymbol` 与面向模型的大纲工具继续延期。

## Alternatives considered

**先扩展 `dsh-lsp` 加入 `documentSymbol`。** 本次变更拒绝：seam 是封闭的四操作、光标位置联合类型；符号需要跨 `dsh-lsp`、`lsp-stdio` 与 `tool-lsp` 的不同请求与结果 schema，且未配置服务器时大纲仍为空。

**面向模型的大纲工具，或 enrich `read` meta。** 首个切片拒绝：预览 UX 不需要模型 token，聊天里的 read 卡片在密度与生命周期上也不适合导航树。

**用 `gpu-lexer` 替换 Shiki，或引入 `react-aria-components` Tree。** 拒绝：高亮已可用；`gpu-lexer` 仅用于显示且仍实验。客户端控件留在 `ui-primitives` / 包内无障碍树，与 Files、JsonTree 模式一致。

## Verification

单元测试覆盖语言扫描器、类视图过滤与大纲上限。客户端规格覆盖 CodeBody 的显示/隐藏、类视图过滤与点击跳行。Store 规格覆盖大纲折叠与视图模式在 reset 后的保留。

## Consequences

大纲准确度是启发式的，且受语言集合限制。嵌套或不寻常语法可能被漏掉；其他语言在增加扫描器或 LSP 路径之前没有窗格。后续 LSP 大纲可以替换或增强本地树，而不必改预览激活契约。
