---
title: "How do React.lazy and Suspense split your bundle, and where should you split?"
level: medium
type: implement
tags: [code-splitting, lazy, suspense, bundle, dynamic-import]
related: [react/suspense-streaming, react/error-boundaries, performance/code-splitting]
---

## Question
Your main bundle is 1.2 MB because it includes a chart library used only on the Analytics tab and a rich-text editor used only in a modal. Show how you would code-split them with `React.lazy` and `Suspense`, and explain what happens at runtime.

## Interview Answer
`React.lazy` takes a function that returns a dynamic `import()`. The bundler sees that `import()` and puts the module in a separate chunk, which is downloaded only the first time the lazy component renders. While the chunk loads, the component suspends and the nearest `<Suspense>` boundary shows its fallback. Once loaded, the module is cached, so later renders are instant. I split at route level and at heavy, conditionally shown UI like modals, editors and charts. I wrap the lazy part in an error boundary in case the chunk fails to load, and I preload on hover or intent, so users rarely see the fallback.

## Explanation
### The basic pattern

```tsx
import { lazy, Suspense, useState } from "react";

// must be declared at module level, never inside a component
const AnalyticsChart = lazy(() => import("./AnalyticsChart")); // needs a default export
const Editor = lazy(() =>
  import("./RichEditor").then((m) => ({ default: m.RichEditor })), // named export
);

export function Dashboard() {
  const [tab, setTab] = useState<"overview" | "analytics">("overview");
  const [editing, setEditing] = useState(false);

  return (
    <>
      <button onClick={() => setTab("analytics")}>Analytics</button>
      <button onClick={() => setEditing(true)}>Edit note</button>

      {/* ErrorBoundary: a class component or the react-error-boundary package */}
      <ErrorBoundary fallback={<p>Couldn't load this section. Refresh to retry.</p>}>
        <Suspense fallback={<ChartSkeleton />}>
          {tab === "analytics" && <AnalyticsChart />}
        </Suspense>
        {editing && (
          <Suspense fallback={<p>Loading editor…</p>}>
            <Editor />
          </Suspense>
        )}
      </ErrorBoundary>
    </>
  );
}
```

### What happens at runtime

```txt
first render of <AnalyticsChart/>
  → lazy calls the import() function → the browser fetches chunk-analytics.js
  → the component suspends → <Suspense> shows <ChartSkeleton/>
  → the chunk resolves → React retries the render → the chart appears
later renders → the module is cached → no fallback
```

### Preloading
Because `import()` caches the module, calling it early warms the cache:

```tsx
const loadEditor = () => import("./RichEditor");
const Editor = lazy(() => loadEditor().then((m) => ({ default: m.RichEditor })));

<button onMouseEnter={loadEditor} onFocus={loadEditor} onClick={() => setEditing(true)}>
  Edit note
</button>
```

### Where to split

| Good split points | Bad split points |
|---|---|
| Routes (frameworks do this automatically) | Small components (more requests than savings) |
| Modals, drawers, editors, charts, maps | Anything visible on first paint (it delays LCP) |
| Admin or rarely used features | Inside a list (one fallback per row) |

Use a bundle analyser (`@next/bundle-analyzer`, `rollup-plugin-visualizer`) to find what is actually heavy.

### In Next.js
The App Router already splits per route segment, and Server Components send no JavaScript for their own code. For client-only heavy widgets, use `next/dynamic`, which wraps `lazy` + `Suspense` and supports `ssr: false` (in Client Components only).

## Follow-ups
- **What happens if the chunk fails to load?** The lazy component throws, and the nearest error boundary catches it. Without one, the whole tree unmounts. A common pattern is to offer a retry, because deploys can remove old chunks.
- **Why must `lazy` be called at module level?** If it is called inside a component, every render creates a new lazy type. React sees a different component, remounts it and loses state.
- **Does switching tabs show the fallback again?** Not after the first load. To avoid replacing already visible content with a fallback during a transition, update the tab in `startTransition`.

## Common Mistakes
- Using `lazy` on a module with only named exports and no `.then` mapping. `lazy` expects `{ default: Component }`.
- One `Suspense` boundary at the root, so any lazy chunk blanks the whole app.
- Lazy-loading above-the-fold content and making LCP worse.

## Tips
- Explain the bundler side ("`import()` creates a separate chunk") as well as the React side ("suspends until it loads"). Many candidates know only one.
- Mention preloading on intent. It shows you think about UX, not only bundle size.
