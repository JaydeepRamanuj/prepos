---
title: "What is the difference between a normal script, async, defer and type=\"module\"?"
level: easy
type: concept
tags: [scripts, async, defer, es-modules, loading]
related: [browser-security/what-happens-when-you-type-a-url, performance/critical-rendering-path]
---

## Question
Explain how these four tags load and execute, and when you would use each:

```html
<script src="a.js"></script>
<script async src="b.js"></script>
<script defer src="c.js"></script>
<script type="module" src="d.js"></script>
```

## Interview Answer
A plain script blocks the HTML parser: the browser stops parsing, downloads the file, runs it, then continues. `async` downloads in parallel with parsing and runs as soon as it arrives — it interrupts parsing at that moment and there is no guaranteed order, so it suits independent scripts like analytics. `defer` also downloads in parallel but runs only after the document is parsed, in document order, just before `DOMContentLoaded`, so it is the right default for app code that touches the DOM. Module scripts are deferred by default, run in strict mode with their own scope, and can also take `async` to run as soon as they and their imports are ready.

## Explanation
### Timeline

```txt
parser:   ────────█████─────────────────────────▶ (█ = paused)
plain:            ↓dl ↓run
async:      ↓download────↓run (whenever ready, pauses parser)
defer:      ↓download──────────────────────────↓run (after parsing, in order)
module:     ↓download + imports ───────────────↓run (like defer)
```

### Comparison

| | Blocks parser while downloading | When it runs | Order kept |
|---|---|---|---|
| plain `<script>` | Yes | Immediately | Yes |
| `async` | No | As soon as downloaded | No |
| `defer` | No | After parsing, before `DOMContentLoaded` | Yes |
| `type="module"` | No | Like `defer` | Yes |
| `type="module" async` | No | When it and its imports are ready | No |

### When to use which
- **`defer`** — your own app scripts. They can safely query the DOM and rely on each other's order.
- **`async`** — independent third-party scripts (analytics, ads) that nothing depends on.
- **`type="module"`** — modern code using `import`. You get deferral for free.
- **Plain** — only when a script must run before the rest of the page parses, such as a tiny inline snippet that sets the theme class to avoid a flash.

### Module script details
- Always **strict mode**, top-level variables are module-scoped, not globals.
- Fetched with **CORS** — a cross-origin module needs `Access-Control-Allow-Origin`.
- Executed **once** even if included twice.
- `nomodule` on a classic script makes it run only in browsers that do not support modules (legacy fallback).

### Inline scripts
`defer` has no effect on inline classic scripts (no `src`). `async` *does* work on inline module scripts.

### Dynamically inserted scripts
A script created with `document.createElement("script")` and appended behaves like `async` by default. Set `script.async = false` to keep insertion order.

### In Next.js
You rarely write these tags by hand. `next/script` has a `strategy` prop (`beforeInteractive`, `afterInteractive`, `lazyOnload`) that picks the loading behaviour for you.

## Follow-ups
- **Why did people put scripts at the end of `<body>`?** — Before `defer` was reliable, that was the way to avoid blocking parsing. `defer` in `<head>` is better because the download starts earlier.
- **Does `defer` wait for CSS?** — Deferred scripts run after parsing; a script also waits for preceding stylesheets to load, because it might read computed styles.
- **What fires first, `DOMContentLoaded` or deferred scripts?** — Deferred scripts run first; `DOMContentLoaded` fires after they finish.

## Common Mistakes
- Saying `async` "does not block" — it does not block *downloading*, but it still pauses the parser while it executes.
- Using `async` for scripts that depend on each other, producing random order bugs.
- Adding `defer` to a module script — harmless but redundant.

## Tips
- One-liner to remember: **async = ASAP, defer = after parse, in order; modules defer by default.**
