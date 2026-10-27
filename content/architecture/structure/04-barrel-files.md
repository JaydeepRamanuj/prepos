---
title: "What are barrel files, and should you use them?"
level: hard
type: concept
tags: [barrel-files, tree-shaking, bundling, circular-imports, nextjs]
related: [architecture/import-boundaries, architecture/feature-vs-layer-folders, architecture/monorepo-when-worth-it]
---

## Question
A teammate added `index.ts` files that re-export everything in each folder, so imports look like `import { Button, Modal, formatDate } from "@/shared"`. Some people say barrel files are bad. What are the pros and cons, and what would you recommend?

## Clues
- What does the bundler or test runner have to load when you import one name from a barrel?
- What happens when two barrels import from each other?
- There is a difference between a barrel acting as a *public API* and a barrel acting as a *convenience*.

## Interview Answer
A barrel is an `index.ts` that re-exports other modules so consumers can import from one path. The upside is clean imports and a defined public API: you can move files around inside a folder without breaking consumers. The downside is that importing a single name can force tools to load and parse every module behind that barrel. That slows dev servers and test runs, can defeat tree-shaking when a module has side effects, and makes circular imports easy to create. I keep barrels small and deliberate, as the public entry of a feature or package. I avoid giant catch-all barrels like `shared/index.ts`, and inside a folder I import files directly. For third-party libraries with huge barrels, Next.js has `optimizePackageImports`, which rewrites them to direct imports.

## Explanation
### What a barrel looks like

```ts
// src/shared/index.ts — a catch-all barrel
export * from "./ui/Button";
export * from "./ui/Modal";      // imports a heavy animation lib
export * from "./ui/DataTable";  // imports a 200 KB table lib
export * from "./lib/date";
export * from "./lib/analytics"; // runs init code at module load (side effect)
```

```ts
// some page
import { formatDate } from "@/shared"; // wanted 1 function...
```

### The costs
1. **Load and parse cost in dev and tests.** ES module semantics require evaluating every module the barrel references, in case one of them has side effects. In dev (no tree-shaking) and in Vitest/Jest, that means loading `Modal`, `DataTable` and `analytics` just to get `formatDate`. In large apps this is a known cause of slow HMR and slow test startup.
2. **Tree-shaking is not guaranteed.** Production bundlers can drop unused exports only when they can prove a module is side-effect free (`"sideEffects": false` in `package.json`, or pure code). A single module that does work at load time can drag the whole barrel in.
3. **Circular imports.** `shared/ui/Modal.tsx` imports `formatDate` from `@/shared`, and `@/shared` imports `Modal`. The cycle may yield `undefined` at runtime depending on evaluation order, which is a confusing bug.
4. **Worse "go to definition"** and noisier auto-imports: the editor suggests the barrel path, not the real file.

### The benefits (real, but narrower)
- **A public API boundary.** `features/cart/index.ts` declares what other code may use, and lint rules can block deep imports.
- **Refactor freedom.** You can restructure internals without touching consumers.
- **Package entry points.** In a monorepo, a package's `exports` map is effectively a barrel and is usually the right design.

### Recommendation

| Situation | Do |
|---|---|
| Feature public API (few exports) | Small explicit barrel: `export { CartButton } from "./components/CartButton"` |
| Generic `shared/` folder | No catch-all barrel. Import `@/shared/ui/button` directly |
| Imports *within* the same feature | Relative or direct path, never through your own barrel (avoids cycles) |
| `export *` | Avoid. It hides what is exported and blocks static analysis |
| Third-party barrel (icons, utils) | Next.js `experimental.optimizePackageImports: ["pkg"]`; some libs such as `lucide-react`, `date-fns` and `lodash-es` are optimized by default |

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["my-icon-library"],
  },
};
export default nextConfig;
```

## Follow-ups
- **How would you find out whether barrels are hurting you?** — Compare dev-server module counts and test startup time, or run a bundle analyzer and look for modules that should not be there. Check for cycles with `madge --circular`.
- **What does `"sideEffects": false` do?** — It tells the bundler that importing a module for nothing does nothing, so unused re-exports can be dropped safely. Lying about it, for example with CSS imports, removes code you needed.

## Common Mistakes
- Saying "barrels break tree-shaking" as an absolute. Production builds often tree-shake them fine. The bigger and more reliable cost is in dev and test time, plus cycles.
- Importing from your own feature's barrel inside that feature, which is the classic way to create a cycle.

## Tips
- Frame it as "barrels as **API**, yes; barrels as **convenience**, no". Interviewers like answers that are nuanced rather than dogmatic.
