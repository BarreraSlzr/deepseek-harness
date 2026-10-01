---
name: frontend-debug-loop
description: Run an evidence-driven frontend debug loop against a live dev server — start it as a background job, drive the mounted browser provider to navigate and screenshot the rendered page or canvas, read console and network errors, diagnose with lsp and run_code, patch with edit, reload, and re-verify. Use when debugging HTML/CSS/DOM rendering, TypeScript/JavaScript runtime behavior, or WebGL/WebGPU (Three.js) canvas output in a browser, in any project served by a dev server such as Vite or Next.js.
---

# Frontend Debug Loop

Close every frontend fix with captured evidence: reproduce the failure in a real browser, name the root cause, apply the smallest patch, and capture the recovery. This skill is guidance, not a script — reorder or skip stages to match the failure, but never claim a fix without a before-and-after capture. Tool names and JSON schemas live in the [tool catalog](../../../docs/tool-catalog.md); the [browser-use subsystem](../../../docs/subsystems/browser-use.md) owns provider selection.

## Check capabilities before the first navigation

- Identify the mounted browser provider from the tool names available to you: `stagehand_*` tools mean the [Stagehand provider](../../../packages/experimental/browser-use-stagehand-native/README.md), `mcp__chrome-devtools-mcp__*` tools mean the [Chrome DevTools MCP provider](../../../packages/experimental/browser-use-chrome-devtools-mcp/README.md), and Playwright-named tools mean the [Playwright MCP provider](../../../packages/experimental/browser-use-playwright-mcp/README.md). One provider runs at a time and each owns different tool names.
- Screenshots need an attachment store and an image-capable model route. A route without image input receives the provider's image diagnostic instead of the screenshot; switch to DOM, console, and network evidence and state that visual verification was unavailable.
- Browser providers are experimental opt-ins and may not be mounted at all. When no browser tools exist, say so, fall back to build output, lsp diagnostics, tests, and HTTP text, and report the loop as non-visual — do not describe inferred behavior as observed rendering.
- `lsp` without a registered language-server provider returns the structured `LSP_UNAVAILABLE` error rather than changing the schema; treat that as a capability gap, not a code defect.

## Start the dev server as a background job

- Run the project's dev command (`npm run dev`, `pnpm dev`, `vite`, `next dev`) with `bash` and `run_in_background: true`, with the project root as the working directory. Keep the returned job id; the server stays up across the whole loop.
- Read readiness from `job_output`, not from assumptions: Vite prints its local URL (`Local: http://localhost:5173/`) and moves to the next free port when the default is busy, so the startup output, not the framework default, owns the URL. Poll `job_output` or fetch the URL once it prints instead of sleeping a fixed interval.
- Run one server per port: list jobs first, and kill any stale dev-server job you started on that port with `job_kill` before starting another. Kill by exact job id only — a broad `pkill` pattern can match the shell that launched it, including your own.

## Reproduce in the browser

- Navigate to the readiness URL, then capture console messages and network failures before screenshots: the first console error is usually the cause, and failed requests point at data or configuration.
- Screenshot the page and read the returned image. For canvas targets — WebGL, WebGPU, Three.js scenes — the screenshot is the primary signal; DOM extraction cannot see the rendered scene. WebGPU renderers initialize asynchronously and fall back silently when no adapter exists, so wait for the first rendered frame before judging a blank canvas.
- A Vite error overlay is a compile error, not a runtime one: fix the reported module or syntax error and let HMR clear the overlay before hunting runtime causes.
- An iframe-embedded target needs explicit frame addressing when the provider has frame tools. Otherwise isolate it: navigate the browser directly to the embed's own URL, or serve a minimal local wrapper page that iframes the dev URL and screenshot the wrapper.

## Diagnose

- Map each console error to its source file and read it; grep the failing symbol when the stack is unclear. Run `lsp` on that file for TypeScript/JavaScript diagnostics alongside the browser evidence.
- Use `run_code` for pure logic checks — expected values, transforms, geometry math — without touching the page.
- Name the root cause in your report before patching. A patch that cannot say what it fixes is a symptom patch.

## Patch and re-verify

- Apply the smallest change with `edit`, honoring the read-before-edit policy. HMR applies most edits on its own; when the page holds broken state or the change touches module initialization, reload the page explicitly.
- Re-capture exactly the evidence you started with — console, network, screenshot — after the reload. The loop closes only when the original failure is gone and no new error appeared; otherwise return to Diagnose.
- A change to product-user-visible GUI behavior in this repository also owes a demonstration GIF; [record-browser-gif](../record-browser-gif/SKILL.md) owns that workflow.

## Improve addressability

- Prefer stable locators — `data-testid`, accessible names, exact text — over positional selectors; they survive the DOM churn a fix introduces.
- Snapshot refs are valid only until the DOM changes: re-run the observe or snapshot step after navigation or mutation before acting on a ref.
- External option for Next.js and other projects: [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) is a standalone browser-automation CLI with snapshot refs, network request tracking, screenshot diffing, and WebGPU-aware checks (`agent-browser doctor --webgpu`); `npx skills add vercel-labs/agent-browser` installs its own maintained skill. To drive that same browser with this harness's tools, read its endpoint with `agent-browser get cdp-url` and point the Chrome DevTools MCP provider's attach mode at it. It is external software: use it only when the user installed it or asked for it, and never install software without authorization.

## Clean up and report

- `job_kill` the dev-server job when the loop ends, and confirm with `job_list` that no job you started is left running.
- Report the evidence chain — failure capture, root cause, patch, recovery capture — naming the provider and tool that produced each artifact, and state plainly which stages ran degraded or not at all.
- Screenshots and console captures can contain user data: keep them under ignored or temporary paths, capture only the target page, and never echo secrets from env files or credentials into the report.

## Limits

- Browser providers are experimental opt-ins with different tool sets; a stage of this loop degrades, it does not silently vanish — say which capability was missing.
- Stagehand's AI-assisted operations run on a separately configured model from its pinned SDK catalog; DeepSeek endpoints are not accepted for that native model, so a Stagehand mount may be navigation-and-screenshot only.
- Headless GPU rendering may use software fallbacks; a scene that renders on a real GPU can differ under headless capture, so compare against the user's observed behavior before blaming the code.
