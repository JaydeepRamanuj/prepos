---
title: "Reduce JavaScript bundle size: analysis, code splitting and tree shaking"
level: medium
type: scenario
tags: [bundle-size, code-splitting, tree-shaking, dynamic-import, analyzer, dependencies]
related: [nextjs/bundle-analysis-optimization, nextjs/code-splitting-lazy, javascript/es-modules]
---

## Question
Your React app's main bundle is 1.2 MB (gzipped 380 KB), and Time to Interactive is poor on mobile. Describe your process to analyse and reduce it. Explain code splitting strategies and when tree shaking fails.

## Interview Answer
I start by measuring: build with a source-map-based analyzer (webpack-bundle-analyzer, `source-map-explorer`, Vite's rollup visualizer, or Next.js's `next analyze`) to see which modules and dependencies dominate. Then I act in order of payoff: split by route so each page loads only its code; lazy-load heavy, rarely used or below-the-fold features (editors, charts, maps, modals) with dynamic `import()`; replace large libraries with smaller or native alternatives; make sure tree shaking works by using ES module builds, named imports and `sideEffects: false`, avoiding barrel files that defeat it; deduplicate multiple versions; remove polyfills for browsers you don't support; and compress with Brotli. I verify with budgets in CI (e.g. 170 KB gzipped JS for first load, adjusted per product) and measure real INP/LCP, since bytes are only a proxy for main-thread cost.

## Explanation
### Analyse

```bash
# Vite
npx vite-bundle-visualizer
# Webpack
npx webpack-bundle-analyzer dist/stats.json
# Any bundler with source maps
npx source-map-explorer dist/assets/*.js
# Next.js 16.1+ (Turbopack)
npx next analyze
```

Look for: giant single dependencies (moment, lodash, chart libraries, icon packs), duplicated packages (two versions of the same lib), whole libraries imported for one function, server-only code leaking into client bundles, large JSON/data inlined, polyfills and locale data.

### Code splitting strategies

1. **Route-based**: each route is its own chunk (automatic in Next.js/Remix; `React.lazy(() => import("./Route"))` with Suspense in SPAs).
2. **Component-based**: lazy-load modals, editors, charts.
3. **Interaction-based**: load on click/hover/visibility.
4. **Vendor/shared chunks**: stable, cacheable vendor chunk (but avoid over-fragmenting).
5. **Preload likely next routes** on hover/idle (`router.prefetch`, `<link rel="modulepreload">`).

```tsx
const Editor = lazy(() => import("./Editor"));

async function exportPdf() {
  const { jsPDF } = await import("jspdf");   // loaded only when needed
}
```

### Tree shaking

Requirements: ES modules (static `import`/`export`), side-effect-free modules, and a bundler in production mode.

```json
// package.json
{ "sideEffects": false }      // or ["*.css"] to keep CSS imports
```

Why it fails:
- CommonJS (`require`) can't be statically analysed (e.g. old lodash: use `lodash-es` or per-method imports).
- **Barrel files** (`index.ts` re-exporting everything) can pull in whole folders, especially when modules have side effects.
- Side effects at module scope (registering things, polyfills, class instances) prevent removal.
- `import * as lib` used dynamically.
- Libraries not published with ESM or `exports` maps.
- Transpilers converting ESM to CJS before bundling (Babel preset-env with `modules: "commonjs"`).

### Replace heavy dependencies

| Heavy | Alternative |
|---|---|
| moment (~70 KB gz with locales) | `Intl.DateTimeFormat`, date-fns/dayjs, Temporal (when available) |
| lodash full | native methods, `lodash-es` named imports, `es-toolkit` |
| axios | `fetch` |
| uuid | `crypto.randomUUID()` |
| numeral/accounting | `Intl.NumberFormat` |
| big UI kits | headless primitives + your CSS |
| Chart libs for simple charts | SVG/CSS or lighter libs (uPlot, Chart.js with tree-shaken registrations) |

### Other levers
- Modern build targets (`browserslist` to evergreen) remove transpilation and polyfills.
- Minification (esbuild/SWC/terser), scope hoisting, dead-code elimination (`process.env.NODE_ENV` replacement).
- Compression: Brotli (≈15–20% smaller than gzip).
- Avoid shipping source maps to users; use `defer` and caching with content hashes.
- React-specific: Server Components reduce client JS; React Compiler doesn't reduce size but reduces work.
- Image/SVG inlining and icon fonts: load icons per-icon.

### Budgets and CI
Use `size-limit`, `bundlewatch` or Lighthouse CI with `resource-summary` budgets to fail PRs that regress. Track first-load JS per route, not just totals.

### Beyond bytes
Parse/compile/execute time matters more on low-end phones (2–5× slower per KB than JSON). Profile with CPU throttling, look at long tasks, and avoid doing heavy initialisation at module scope.

## Follow-ups
- **Is a smaller gzip size always better?** — Not if it increases execution time (e.g. heavy runtime decompress); measure on target devices.
- **How big should chunks be?** — Aim for cacheable shared chunks and per-route chunks; too many tiny chunks hurt via request overhead (HTTP/2 mitigates).

## Common Mistakes
- Lazy-loading everything, creating waterfalls.
- Barrel-file imports in client code.
- Measuring only uncompressed size.

## Tips
- Say "measure, split, replace, verify" and mention main-thread cost.
