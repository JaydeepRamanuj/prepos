---
title: "Turbopack is the default in Next.js 16: what changed and how do you migrate or opt out?"
level: medium
type: concept
tags: [turbopack, webpack, next-16, bundler, build, filesystem-cache]
related: [nextjs/next-config-essentials, nextjs/bundle-analysis-optimization, nextjs/vercel-vs-self-hosting]
---

## Question
What is Turbopack, what changes in Next.js 16 where it is the default for `next dev` and `next build`, and how do you handle custom Webpack config, loaders and the minimum requirements?

## Interview Answer
Turbopack is Next.js' Rust-based bundler, built around incremental computation and caching so only changed parts are recomputed. In Next.js 16 it's the default bundler for both `next dev` and `next build`, with substantial improvements in dev start-up, Fast Refresh and build times, and an optional file-system cache that persists compiler artifacts between runs. If a project has a custom `webpack` function in `next.config`, `next build` fails by default to avoid silently ignoring it; the options are to migrate to the top-level `turbopack` config (loader rules, aliases, resolve extensions), or opt out with the `--webpack` flag. The top-level `turbopack` config replaced the old `experimental.turbo` location. Next.js 16 also requires Node.js 20.9+, TypeScript 5.1+, and targets modern browsers (Chrome/Edge/Firefox 111+, Safari 16.4+).

## Explanation
### Commands

```json
{
  "scripts": {
    "dev": "next dev",                    // Turbopack by default
    "build": "next build",                // Turbopack by default
    "build:webpack": "next build --webpack"
  }
}
```

### Configuration moved

```ts
// next.config.ts (16)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.svg": { loaders: ["@svgr/webpack"], as: "*.js" },     // loader rules
    },
    resolveAlias: { "old-lib": "new-lib" },
    resolveExtensions: [".tsx", ".ts", ".js", ".json"],
  },
};
export default nextConfig;
```

Previously this lived under `experimental.turbo`; the codemod updates it. Many Webpack loaders work through Turbopack's loader-runner, but plugins that mutate the compilation (custom Webpack plugins) don't.

### Migration checklist
1. Upgrade Node.js to ≥ 20.9 and TypeScript ≥ 5.1.
2. Run `npx @next/codemod@canary upgrade latest` (updates config, removes unstable prefixes).
3. If you have `webpack()` customisation, list what it does: aliases, SVG handling, `DefinePlugin`, bundle analyzer, polyfills. Move to `turbopack` config or built-in features (e.g. `images`, `sassOptions`, `transpilePackages`).
4. Replace `@next/bundle-analyzer` with `next analyze` (Turbopack analyzer, v16.1+) if you want.
5. Remove ESLint/`next lint` assumptions: `next lint` command was removed; run ESLint or Biome directly.
6. Test CSS imports (`@import` in Sass requires modern Sass API; `~` prefix imports changed), and `resolve.fallback` equivalents (`turbopack.resolveAlias` with browser conditions).
7. Run `next build` and compare outputs; keep `--webpack` as a temporary fallback.

### Features
- **File System Caching** (`turbopackFileSystemCache`): persists compiler artifacts under `.next` for faster restarts and builds; in this version both the dev and build options (`experimental.turbopackFileSystemCacheForDev` / `ForBuild`) default to on.
- **Faster Refresh and builds**: parallelised Rust pipeline; typical improvements are multiple times faster dev compile and build.
- **Concurrent `dev` and `build`**: Next.js 16 lets you run `next dev` and `next build` at the same time (separate output dirs).
- **Server Components HMR cache** and better error overlays.
- **React Compiler** support is stable via config and works under Turbopack (a Babel plugin step is used for it).

### When to stay on Webpack
- Heavy custom Webpack plugins (module federation, bespoke asset pipelines) with no equivalent.
- Third-party tooling that injects Webpack config.
Opt-out is supported with `next dev --webpack` / `next build --webpack` for now; plan to migrate.

### Interview angle
Be able to say why a Rust, incremental, function-level cached bundler is faster (fine-grained dependency tracking and memoisation across dev and build), what broke for people (custom webpack config, Sass imports, loaders), and how to opt out.

## Follow-ups
- **Does Turbopack change production output?** — Output is optimised similarly (tree-shaking, minification); sizes can differ slightly, so compare with the analyzer.
- **What about `next lint`?** — Removed in 16; call ESLint directly (flat config).

## Common Mistakes
- Leaving a legacy `webpack` function and being surprised by the build error.
- Using the old `experimental.turbo` key.

## Tips
- Mention the Node/TS minimums and the opt-out flag; they're practical details.
