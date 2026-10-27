---
title: "The JavaScript bundle doubled in a month. How do you find out why and bring it back down?"
level: hard
type: scenario
tags: [bundle-size, code-splitting, tree-shaking, barrel-files, dynamic-import, budgets, analyzer]
related: [performance/bundle-analysis, architecture/barrel-files, react/code-splitting-lazy]
---

## Question
Your Next.js app's first-load JS grew from 180 KB to 360 KB (gzip) over a month, and LCP and INP degraded on mid-range phones. No one remembers a big change. How do you diagnose and fix it, and prevent it from creeping back?

## Clues
- You need a before/after comparison, not just a snapshot.
- Size problems come from a short list of patterns.
- A budget in CI stops silent growth.

## Interview Answer
I'd start by measuring precisely: run the bundle analyzer for the current build and for a build from a month ago (git tags or CI artifacts), compare route-level first-load JS, and identify which chunks and modules grew. The usual culprits are new dependencies (date, charting, editor, icon or animation libraries), importing whole libraries or barrel files that defeat tree-shaking (`import _ from "lodash"`, `import * as Icons`), heavy components bundled into the main route instead of lazily loaded (editors, charts, modals, maps), code shared by many routes that pulled in server-only or admin-only code, duplicated packages in different versions, polyfills or transpilation targets that are too broad, and third-party scripts. For each, I apply the right fix: replace or drop the dependency, use named or deep imports and `optimizePackageImports`, dynamic `import()` / `next/dynamic` for below-the-fold or interaction-triggered UI, move work to Server Components so the code stays off the client, dedupe versions, and tighten browserslist. Then I verify with the analyzer and Lighthouse/RUM, and add guardrails: a size budget in CI (fail or comment on PRs exceeding thresholds), analyzer reports per PR, a dependency-addition checklist, and periodic reviews.

## Explanation
### Diagnose
1. **Build output**: `next build` lists first-load JS per route; note the shared chunk.
2. **Analyzer**: `@next/bundle-analyzer` (webpack) or the Turbopack bundle analysis tooling available in your Next.js version (check the bundled docs); open the treemap, look at the biggest modules and which routes include them.
3. **Compare** with the older build: diff stats (`webpack-stats` / analyzer JSON) to see added modules.
4. **Trace imports**: find *why* a module is included (analyzer "reasons"/import traces, `source-map-explorer`, `npm ls`).
5. **Check dependencies**: `git diff` of `package.json`; tools like Bundlephobia/Pkg-size to evaluate cost.
6. **Field impact**: RUM for JS execution time and INP on low-end devices.

### Common causes and fixes

| Cause | Symptom in analyzer | Fix |
|---|---|---|
| Whole-library import | `lodash` (70 KB) or `moment` with locales | `lodash-es` per-function imports or native; `date-fns`/`Intl`/Temporal |
| Barrel file re-exports | entire `components/index.ts` tree included | import from the specific file; avoid barrels in hot paths; use `optimizePackageImports` for large libs like icon sets |
| Heavy widget in initial bundle | rich text editor, chart, map in main route chunk | `next/dynamic` with `ssr: false` only when needed, load on interaction/visibility |
| Client Components too high in the tree | big component trees under `"use client"` | push the boundary down; render static parts on the server |
| Server-only code on the client | `fs`, ORM, large validators | `import "server-only"`; separate client/server modules |
| Duplicated packages | two versions of the same lib | dedupe (`npm dedupe`), align versions, overrides |
| Large JSON/data bundled | translations/all locales, static datasets | load per locale or fetch lazily; move to the server |
| Icon sets | importing the entire pack | per-icon imports or SVG sprite |
| Polyfills / low browser targets | legacy transforms | modern `browserslist`, avoid unnecessary polyfills |
| Third-party scripts | analytics, chat, tag manager | `next/script` with `lazyOnload`, partytown, audit necessity |
| Dev-only code in prod | debug tools, mock handlers | environment checks and dead-code elimination |
| CSS-in-JS runtime | large runtime | static CSS solutions |

### Example: lazy load a heavy component
```tsx
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  loading: () => <p>Loading editor…</p>,
});

export function CommentBox({ editing }: { editing: boolean }) {
  return editing ? <RichTextEditor /> : <button>Write a comment</button>;   // editor JS only loads on demand
}
```
Also preload on hover/focus for responsiveness: `onPointerEnter={() => import("@/components/RichTextEditor")}`.

### Verify wins
Re-run the build and analyzer; compare route sizes; Lighthouse in throttled mode; RUM after deploy. Parse and execution time matter more than transfer size on slow devices, so track main-thread blocking (TBT/INP).

### Prevent regressions
- **Budgets in CI**: tools like `size-limit`, `bundlewatch`, or Next.js build output parsing with thresholds per route.
- **PR comment** with bundle diff (e.g. via GitHub Action) so reviewers see impact.
- **Dependency policy**: justify each new package's size and alternatives; prefer platform APIs.
- **Regular audits**: quarterly analyzer review, `depcheck` for unused dependencies.
- **Performance culture**: show Web Vitals dashboards to the team.

### Compression and delivery (complementary)
Brotli compression, HTTP caching with immutable fingerprinted chunks, preloading critical chunks, and avoiding large shared chunks that invalidate frequently. These help transfer but don't reduce parse/execute cost.

## Follow-ups
- **Does gzip size tell the whole story?** — No; parsed JS size and execution time drive CPU cost, especially on low-end devices.
- **Are barrel files always bad?** — They're fine for small internal modules with good tree-shaking, but can cause problems with large libraries or side effects; measure.

## Common Mistakes
- Optimising without a baseline.
- Lazy-loading everything, creating waterfalls and layout shifts.
- Adding libraries for trivial utilities.

## Tips
- Say "compare, trace the import, apply the specific fix, add a budget".
