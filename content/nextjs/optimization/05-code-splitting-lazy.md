---
title: "Code splitting and lazy loading in the App Router: next/dynamic, React.lazy and Server Components"
level: medium
type: concept
tags: [code-splitting, lazy-loading, next-dynamic, react-lazy, bundle-size, ssr-false]
related: [nextjs/bundle-analysis-optimization, nextjs/third-party-and-browser-only-code, javascript/es-modules]
---

## Question
How does Next.js split code automatically, and when do you add manual lazy loading with `next/dynamic` or `React.lazy`? What are the rules for Server and Client Components, and what is the effect of `ssr: false`?

## Interview Answer
Next.js splits code by route automatically, so each page only loads the JavaScript it needs, and Server Components don't ship JavaScript at all. I add manual lazy loading for heavy Client Components or libraries that aren't needed at first paint, such as modals, charts, rich text editors or code highlighters, using `next/dynamic` (a wrapper around `React.lazy` and Suspense) or `React.lazy` with `<Suspense>`, or a dynamic `import()` inside an event handler for libraries. Dynamic imports of Client Components get their own chunk loaded on demand; `ssr: false` skips server rendering for the component and is only allowed from Client Components. If a Server Component dynamically imports a Client Component, automatic client-side splitting isn't applied, so I do the lazy import inside a Client Component. I verify the effect with the bundle analyzer, not by guessing.

## Explanation
### Automatic splitting
- Route-level chunks: navigating loads the next route's chunk (prefetched when `<Link>` is visible).
- Shared chunks for common dependencies.
- Server Components ship zero JS; only Client Components and their imports are in client bundles.

### `next/dynamic`

```tsx
"use client";
import dynamic from "next/dynamic";
import { useState } from "react";

const Chart = dynamic(() => import("./chart"), {
  loading: () => <div className="h-64 animate-pulse bg-sunken" />,   // reserve space
});
const Editor = dynamic(() => import("./editor"), { ssr: false });    // browser-only

export function Panel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chart />                                 {/* separate chunk, loaded when rendered */}
      <button onClick={() => setOpen(true)}>Edit</button>
      {open && <Editor />}                      {/* chunk loaded when first rendered */}
    </>
  );
}
```

### `React.lazy` + Suspense

```tsx
const Heavy = React.lazy(() => import("./heavy"));
<Suspense fallback={<Spinner />}><Heavy /></Suspense>
```

Client Components are still prerendered on the server by default.

### Libraries on demand

```tsx
async function exportPdf() {
  const { jsPDF } = await import("jspdf");     // loaded only when the user clicks export
  const doc = new jsPDF();
  // …
}
```

```tsx
const [fuse, setFuse] = useState<typeof import("fuse.js").default | null>(null);
async function onFocus() {
  if (!fuse) setFuse((await import("fuse.js")).default);
}
```

### Rules and gotchas
- `ssr: false` works only inside Client Components; using it in a Server Component is an error.
- A Server Component importing a Client Component dynamically doesn't get automatic client splitting; put the `dynamic` call in a Client Component wrapper.
- Dynamically importing a Server Component lazy-loads only the Client Components it renders (and preloads their CSS), not the server code.
- Named exports: `dynamic(() => import("./mod").then((m) => m.Named))`.
- Don't lazy-load above-the-fold content (it delays LCP and adds a waterfall).
- Provide a `loading` UI sized like the final component to avoid CLS.
- Too many tiny chunks hurt via request overhead; group by feature.
- Turbopack has options controlling lazy dynamic import behaviour in dev.

### When to lazy-load

| Candidate | Why |
|---|---|
| Modals, drawers, tooltips with heavy content | not visible at first paint |
| Charts, maps, editors | large dependencies |
| Admin-only widgets | most users don't need it |
| Locale data, big JSON | load on demand |
| Polyfills for rare browsers | conditional |

### Measuring
`next analyze` (Turbopack bundle analyzer, v16.1+) or `@next/bundle-analyzer` for Webpack builds; compare first-load JS per route before and after.

## Follow-ups
- **`next/dynamic` vs `React.lazy`?** — `next/dynamic` adds `ssr` and `loading` options and works in both routers; `React.lazy` is the React primitive.
- **Does lazy loading help INP?** — Yes, by reducing main-thread work during load, but the chunk load happens later on interaction.

## Common Mistakes
- Lazy-loading the hero.
- Using `ssr: false` in a Server Component.
- No placeholder, causing layout shift.

## Tips
- Say what you'd load lazily in a real dashboard (chart, editor, export library) and verify with the analyzer.
