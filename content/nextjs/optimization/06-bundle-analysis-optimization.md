---
title: "Your first-load JS is 480 KB: how do you analyse and shrink the bundle?"
level: hard
type: scenario
tags: [bundle-size, analyzer, tree-shaking, barrel-files, optimizePackageImports, server-components]
related: [nextjs/code-splitting-lazy, nextjs/server-vs-client-components, performance/bundle-analysis, javascript/es-modules]
---

## Question
A page ships 480 KB of JavaScript on first load and INP is poor. Walk through how you find the cause and the changes you'd make in a Next.js 16 app, in order of expected impact.

## Clues
- Measure first with the bundle analyzer, filtering by route and client/server.
- Move work to Server Components to remove JavaScript entirely.
- Look for barrel imports, duplicate dependencies and big libraries used for small tasks.

## Interview Answer
I run the bundle analyzer (`next analyze` with Turbopack in 16.1+, or `@next/bundle-analyzer` for Webpack), filter to the route's client bundle, and look at the largest modules and their import traces to find why each is there. Typical fixes in order of impact: move non-interactive components and heavy rendering libraries (markdown, syntax highlighting, date formatting) to Server Components so they ship no JS; shrink `"use client"` boundaries so only interactive leaves are client code; lazy-load heavy, below-the-fold or interaction-triggered components with `next/dynamic` or dynamic `import()`; replace large libraries with lighter ones or native APIs (`Intl`, `structuredClone`, `fetch`); fix barrel-file imports and use `optimizePackageImports` for icon/utility libraries; deduplicate packages; and remove polyfills and unused dependencies. After each change I re-measure first-load JS per route and check INP in the field, because bundle size is a means, not the goal.

## Explanation
### 1. Measure

```bash
npx next analyze          # Turbopack bundle analyzer (v16.1+): filter by route, environment, type
# or, with Webpack builds:
ANALYZE=true next build   # using @next/bundle-analyzer
```

Look for:
- The biggest modules in the route's client bundle and their import chains ("who pulled this in?").
- Duplicate versions of the same package.
- Server-only code leaking into the client graph (database drivers, `fs`).
- Whole libraries imported for one function (`moment`, `lodash`).

### 2. Remove JS by moving work to the server
- Components without state/effects/handlers should be Server Components.
- Render markdown, highlight code and format data on the server; send HTML.
- Push `"use client"` down to the leaf (button, input) and pass server-rendered children in.

### 3. Defer what isn't needed immediately

```tsx
const Chart = dynamic(() => import("./chart"), { loading: () => <ChartSkeleton /> });

async function onExport() {
  const { utils, writeFile } = await import("xlsx");
  // …
}
```

### 4. Fix imports

```ts
// Barrel imports can pull whole libraries and slow compilation
import { Camera } from "lucide-react";               // OK with optimizePackageImports (many libraries are on the default list)

// next.config.ts
export default { experimental: { optimizePackageImports: ["@acme/ui", "date-fns"] } };
```

Prefer direct/deep imports for libraries without `sideEffects: false` or ESM exports.

### 5. Swap heavy dependencies

| Heavy | Lighter option |
|---|---|
| moment | `Intl.DateTimeFormat`, date-fns/dayjs |
| lodash (full) | native methods, `lodash-es` named imports |
| big icon pack imports | per-icon imports or SVG sprites |
| axios | `fetch` |
| client-side markdown parser | render on the server |
| chart libs for simple charts | SVG/CSS or a lightweight library |

### 6. Other wins
- Remove unused dependencies and dead code (`knip`, `depcheck`).
- Avoid shipping polyfills for evergreen browsers (Next.js 16 targets Chrome/Edge/Firefox 111+, Safari 16.4+).
- Use `serverExternalPackages` and `transpilePackages` appropriately; they affect the server side mostly.
- Check `sideEffects` flags in internal packages so tree-shaking works.
- React Compiler reduces re-render work (INP), though not bundle size.
- Third-party scripts: audit separately (they aren't in the bundle).

### 7. Verify

```txt
Before:  /dashboard  First load JS 480 KB
After:   move markdown+highlight to server (-140), lazy chart (-120), icon imports (-30), drop moment (-60) => ~130 KB
```

Track first-load JS per route in CI (`next build` output or Lighthouse CI budgets) and INP/LCP in the field.

### Pitfall
Focusing on gzip size alone; parse and execute time on mid-range phones is what hurts INP, so also profile main-thread time.

## Follow-ups
- **What is "First Load JS"?** — The JavaScript needed to load a route, including shared chunks.
- **How do I find what imported a package?** — The analyzer's import trace view.

## Common Mistakes
- Optimising randomly without the analyzer.
- Lazy-loading everything.
- Keeping `"use client"` at page level.

## Tips
- Order your answer: measure → remove (server) → defer → replace → verify.
