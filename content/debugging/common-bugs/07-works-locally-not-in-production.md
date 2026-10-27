---
title: "It works locally but breaks in production. Where do you look?"
level: hard
type: scenario
tags: [env-vars, caching, case-sensitivity, deployment, nextjs]
related: [debugging/production-error-debugging, debugging/cors-error-explained, debugging/hydration-mismatch]
---

## Question
After deploying a Next.js app to Vercel, three things break that worked on your Mac:

1. The build fails with `Module not found: Can't resolve './components/Header'`.
2. The analytics script never loads; in the bundle `process.env.NEXT_PUBLIC_ANALYTICS_ID` is `undefined`.
3. Some users still see the old UI an hour after the deploy, and a few get `ChunkLoadError`.

Walk through the root cause of each and how you would fix and prevent it.

## Clues
- macOS's default file system and Linux treat `Header.tsx` and `header.tsx` differently.
- When exactly are `NEXT_PUBLIC_` variables read — at build time or at request time?
- Which layers between your server and the user can hold on to old files?

## Interview Answer
I treat "works locally" as "some difference between the environments" and list the usual suspects: file system, environment variables, build mode, caching, data and network. The module error is case sensitivity — the file is `header.tsx` but the import says `Header`; macOS's file system is case-insensitive by default so it resolves locally, but the Linux build server doesn't, so I fix the file name with `git mv` and turn on a lint rule. The missing variable is because `NEXT_PUBLIC_` values are inlined into the JavaScript at build time — it was set locally in `.env.local` but not in the Vercel project for that environment, or it was added after the build, so I add it and redeploy. The stale UI is caching: the HTML or a service worker is cached, while old chunk files were removed, so I check `Cache-Control` headers, make HTML revalidate, keep fingerprinted assets immutable, and handle `ChunkLoadError` by reloading once. To prevent all three, I run a production build (`next build && next start`) locally or in CI on Linux before merging.

## Explanation
### The environment-difference checklist

| Difference | Local | Production |
|---|---|---|
| File system | macOS/Windows: case-insensitive by default | Linux: case-sensitive |
| Env vars | `.env.local` on your machine | Set per environment in the host's dashboard |
| Build mode | `next dev` (no minification, on-demand compile) | `next build` (minified, prerendered, tree-shaken) |
| Caching | Usually none | CDN, browser, service worker, framework caches |
| Data | Seeded, small, your account | Real, messy, many roles |
| Network | Same machine, no CORS, HTTP | Different domains, HTTPS, proxies |
| Runtime | Your Node version | The platform's configured Node version |

### 1. Case-sensitive imports

```bash
# file on disk: components/header.tsx ; import uses './components/Header'
git mv components/header.tsx components/Header.tsx
```

Plain renaming in Finder often doesn't register with git on a case-insensitive file system (git config `core.ignorecase`), so the old name stays in the repository — `git mv` makes the rename real. Prevent it with `eslint-plugin-import`'s `import/no-unresolved` (case-sensitive checking) and a CI build on Linux.

### 2. Build-time env vars

```ts
// Inlined at `next build`: the string literal replaces the expression in the client bundle
const id = process.env.NEXT_PUBLIC_ANALYTICS_ID;

// NOT inlined: dynamic lookups stay undefined in the browser
const key = "NEXT_PUBLIC_ANALYTICS_ID";
process.env[key]; // undefined on the client
```

Consequences:
- The variable must exist **when the build runs**, for that environment (Preview vs Production are separate on Vercel). Changing it later requires a rebuild.
- One Docker image promoted from staging to production keeps staging's public values. For runtime config, read it on the server (Server Component, route handler) and pass it down.
- Variables without the prefix are server-only and are `undefined` in client code — by design, so secrets don't leak.

Validate env vars at startup (e.g. a Zod schema in `env.ts`) so a missing value fails the build with a clear message instead of failing silently.

### 3. Stale UI and `ChunkLoadError`

```txt
user loaded HTML v1 (cached) ──▶ it references /_next/static/chunks/page-a1b2.js
deploy v2 ──▶ v1 chunks no longer served
user navigates ──▶ client requests page-a1b2.js ──▶ 404 ──▶ ChunkLoadError
```

Fixes:
- **Hashed assets**: `Cache-Control: public, max-age=31536000, immutable` (frameworks do this).
- **HTML**: must revalidate (`no-cache` or a short `s-maxage` with revalidation), so users get the new asset list.
- **Service worker**: version it and activate updates; a stale SW serving old HTML is a classic cause.
- **Deploy skew**: hosts like Vercel offer skew protection that keeps old deployments' assets reachable for clients still on them. Otherwise, catch the chunk error and reload once.
- **Framework data caches**: in Next.js, a page you expected to be dynamic may have been prerendered at build time; check the build output and your caching config.

### Debug approach
1. Reproduce against production artifacts: `next build && next start` locally.
2. Compare env: print the non-secret config in a debug endpoint or build log.
3. Network tab on production: response headers (`cache-control`, `age`, `x-vercel-cache`), 404s for chunks.
4. Read the build log, not just the runtime error.

## Follow-ups
- **How do you make a public config value changeable without a rebuild?** — Serve it from the server at runtime (render it into the page from a Server Component, or fetch it from an endpoint) instead of `NEXT_PUBLIC_`.
- **Why does dev mode hide bugs?** — No minification, different caching, StrictMode double effects, on-demand compilation; a production build is a different program.
- **Other classic "local only" causes?** — Mixed content (HTTP API on an HTTPS site), CORS because of different domains in production, and a different Node version on the platform.

## Common Mistakes
- Setting the env var in the dashboard and expecting the existing deployment to pick it up.
- Putting secrets in `NEXT_PUBLIC_` variables to "make them work" on the client.
- Telling users to hard-refresh instead of fixing cache headers.

## Tips
- Start your answer with the checklist (file system, env, build mode, caching, data, network) — it shows a method before details.
- "Inlined at build time" is the key phrase for `NEXT_PUBLIC_`.
