# Agent Note: Local code-preview Document Outline

Status: implemented

English | [中文](2026-09-28-local-code-preview-document-outline.zh.md)

## Problem

Code preview already highlights source and jumps to a 1-based line, but readers cannot scan a file's structure the way an IDE Document Outline or Class View does. Extending the closed LSP seam with `documentSymbol`, adding a model-facing outline tool, or swapping Shiki for an experimental highlighter would each change a different product contract. The first shipping path had to improve preview navigation without those costs.

## Decision

Code preview (`ui-sidebar-documentpreview` code body) builds a presentation-only outline from the accumulated text with language-specific heuristic scanners (TypeScript/JavaScript, Python, Markdown/MDX, JSON, YAML). The pane offers Document Outline and Class View, collapses beside the source, and activates rows through the existing `scrollToLine` path. Collapse and view mode live on the preview `TextStore` with the tab. Unsupported languages and empty scans hide the pane. The outline never enters the Session log or model request. Shiki remains the highlighter; `gpu-lexer` and `react-aria-components` are not adopted. LSP `documentSymbol` and a model-facing outline tool stay deferred.

## Alternatives considered

**Extend `dsh-lsp` with `documentSymbol` first.** Rejected for this change: the seam is a closed four-operation, cursor-position union; symbols need different request and result schemas across `dsh-lsp`, `lsp-stdio`, and `tool-lsp`, and outline would still be empty without a configured server.

**Model-facing outline tool or enriching `read` meta.** Rejected for the first slice: preview UX does not need model tokens, and chat read cards are the wrong density and lifetime for a navigation tree.

**Replace Shiki with `gpu-lexer`, or add `react-aria-components` Tree.** Rejected: highlighting already works; `gpu-lexer` is display-only and experimental. Client controls stay in `ui-primitives` / package-local accessible trees, matching Files and JsonTree patterns.

## Verification

Unit tests cover language scanners, Class View filtering, and outline caps. Client specs cover show/hide, Class View filtering, and click-to-line scrolling on CodeBody. Store specs cover outline collapse and view persistence across reset.

## Consequences

Outline accuracy is heuristic and language-limited. Nested or unusual syntax can be missed; other languages have no pane until a scanner or LSP path lands. A later LSP outline can replace or augment the local tree without changing the preview activation contract.
