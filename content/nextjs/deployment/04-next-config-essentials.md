---
title: "next.config essentials: redirects, rewrites, headers and when to use proxy instead"
level: medium
type: concept
tags: [next-config, redirects, rewrites, headers, basePath, output]
related: [nextjs/proxy-ts-replaces-middleware, nextjs/csp-and-security-headers, nextjs/static-export-spa-mode]
---

## Question
Explain `redirects`, `rewrites` and `headers` in `next.config.ts`: how they differ, how they're ordered with proxy and the filesystem, and which you'd use for a domain migration, an API proxy, and a CDN cache policy. Mention other commonly used config keys.

## Interview Answer
`redirects` send the browser to a new URL with a 307/308 status, so the URL changes; I use them for permanent moves and domain or path migrations (308 with `permanent: true`). `rewrites` map an incoming path to a different destination without changing the visible URL, and are useful for proxying `/api/*` to another backend, for gradual migrations, or for clean public URLs; with `beforeFiles`, `afterFiles` and `fallback` phases they control order against the filesystem. `headers` add response headers for matching paths, such as cache policies or security headers. They're declarative and fast, so I prefer them over `proxy.ts` unless I need request data like cookies or conditional logic. Matching supports path params, regex groups and `has`/`missing` conditions on headers, cookies, host and query.

## Explanation
### Examples

```ts
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  async redirects() {
    return [
      { source: "/blog/:slug", destination: "/articles/:slug", permanent: true },    // 308
      { source: "/:path*", has: [{ type: "host", value: "old.example.com" }],
        destination: "https://www.example.com/:path*", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/health", destination: "/api/health" }],
      afterFiles: [],
      fallback: [{ source: "/:path*", destination: "https://legacy.example.com/:path*" }],  // only if no Next route matches
    };
  },
  async headers() {
    return [
      { source: "/_next/static/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
};
export default config;
```

### Redirect vs rewrite

| | Redirect | Rewrite |
|---|---|---|
| Browser URL | changes | unchanged |
| Status | 307/308 (or 301/302 via `statusCode`) | none (proxied internally) |
| Extra request | yes (client follows) | no |
| Use | moved content, canonicalisation | proxying, friendly URLs, migrations |

### Order of evaluation

1. `headers`
2. `redirects`
3. proxy (`proxy.ts`)
4. `rewrites.beforeFiles`
5. filesystem routes (`public/`, `_next/static`, `app/`)
6. `rewrites.afterFiles`
7. dynamic routes
8. `rewrites.fallback`

### Config vs proxy

| Need | Use |
|---|---|
| Static mapping of paths | `redirects` / `rewrites` |
| Condition on cookie, header, host, query | config `has`/`missing`, or proxy |
| Complex logic, per-request values (nonce, A/B assignment) | `proxy.ts` |
| Same headers for many routes | `headers()` |
| Large lists of redirects (thousands) | proxy with a lookup, bulk redirects at the CDN, or a Route Handler; config limits apply (e.g. 1,024 on Vercel) |

### Other keys worth knowing
- `basePath`, `assetPrefix`: serve under a subpath or CDN.
- `output: "standalone"` (small self-contained server for Docker) or `"export"` (static HTML).
- `images`: `remotePatterns`, `qualities`, `formats`.
- `cacheComponents`, `cacheLife`, `partialPrefetching`: caching model.
- `serverActions`: `allowedOrigins`, `bodySizeLimit`.
- `transpilePackages`, `serverExternalPackages`: control bundling of dependencies.
- `reactCompiler`, `typedRoutes`, `experimental.optimizePackageImports`.
- `trailingSlash`, `skipTrailingSlashRedirect`.
- `logging.fetches` for debugging.
- `deploymentId`: version skew protection.

### Gotchas
- `redirects` and `rewrites` are not supported with `output: "export"`; static hosts need their own rules.
- Matchers are `path-to-regexp` patterns; unescaped parentheses and `:path*` modifiers behave specially.
- Rewrites to external URLs make Next.js act as a reverse proxy: mind timeouts, auth and CORS.
- `headers` don't apply to responses already produced with their own headers if the handler sets them later; test in production mode.
- Config is evaluated at build/start; changing it requires a restart or redeploy.

## Follow-ups
- **Permanent vs temporary redirect?** — `permanent: true` → 308, cached aggressively by browsers/search engines; `false` → 307.
- **Can rewrites hide an API key?** — They can proxy server-side, but adding secrets needs proxy/route handler logic, as config rewrites don't inject secrets.

## Common Mistakes
- Using a redirect when a rewrite was intended (URL changes unexpectedly).
- Putting hundreds of redirects in config and hitting limits.
- Forgetting order of evaluation when debugging.

## Tips
- Explain the order list; interviewers like candidates who can debug "why didn't my rewrite apply".
