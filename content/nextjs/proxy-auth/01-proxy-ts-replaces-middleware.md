---
title: "What is proxy.ts, how does it differ from middleware, and what should it (not) do?"
level: medium
type: concept
tags: [proxy, middleware, next-16, matcher, rewrites, redirects, runtime]
related: [nextjs/optimistic-auth-checks-proxy, nextjs/data-access-layer, nextjs/node-vs-edge-runtime, nextjs/server-actions-are-public-endpoints]
---

## Question
Next.js 16 renamed `middleware.ts` to `proxy.ts`. What changed besides the name? How do you scope it with `matcher`, what runs before and after it, which tasks suit it, and what should you avoid doing in it?

## Interview Answer
`proxy.ts` is the same concept as middleware: code that runs before a request is completed, which can rewrite, redirect, set headers or cookies, or respond directly. Next.js 16 renamed the file and the exported function (`export function proxy`) to make its role clearer and to stop it being confused with Express-style middleware, and the `middleware` convention is deprecated. A notable difference is the runtime: proxy runs on the Node.js runtime by default and the `runtime` option isn't available, whereas middleware had defaulted to the Edge runtime. I scope it with `config.matcher` so it doesn't run on static assets, since without a matcher it runs on every request. It suits redirects, rewrites for A/B tests or locales, header and cookie tweaks, and optimistic auth checks. It isn't for slow data fetching, session management or authorisation, because it's separate from render code, can be skipped by matcher gaps, and doesn't cover everything, so the real checks belong near the data.

## Explanation
### Basic example

```ts
// proxy.ts (at the project root or in src/)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/old-blog")) {
    return NextResponse.redirect(new URL("/blog", request.url));
  }
  const res = NextResponse.next();
  res.headers.set("x-request-id", crypto.randomUUID());
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],   // skip assets and API
};
```

Only one `proxy` file per project; split logic into imported modules. `matcher` values must be constants (statically analysed). Matchers can use `has`/`missing` conditions on headers, cookies and query params.

### Where it sits in the request chain

1. `headers` from `next.config`
2. `redirects` from `next.config`
3. **Proxy**
4. `beforeFiles` rewrites
5. Filesystem routes (`public/`, `app/`, `pages/`)
6. `afterFiles` rewrites
7. Dynamic routes
8. `fallback` rewrites

Prefer `redirects` in `next.config` for simple static redirects; use proxy when you need request data.

### Middleware to proxy

| | middleware (≤15) | proxy (16) |
|---|---|---|
| File/export | `middleware.ts` / `middleware()` | `proxy.ts` / `proxy()` |
| Default runtime | Edge | Node.js (no `runtime` option) |
| Purpose | same | same, clearer name |
| Migration | — | codemod: `npx @next/codemod@canary middleware-to-proxy .` |

If you specifically need Edge behaviour, the docs suggest keeping the deprecated `middleware` convention for now.

### Good uses
- Redirects and rewrites based on cookies, headers, geo, A/B variants.
- Setting security headers or request ids; adding CSP nonces.
- Locale detection and routing.
- Optimistic auth redirects: reading a cookie and redirecting unauthenticated users away from `/dashboard`.
- Logging with `event.waitUntil(...)` for work after the response.

### Poor uses
- Database lookups per request (slow, runs on every matched request).
- Full session validation or authorisation (see below).
- Sharing state through module globals: proxy can be deployed separately (for example to a CDN), so don't rely on shared modules or globals; pass data via headers, cookies, rewrites or the URL.
- Heavy computation or large dependencies.
- Caching via `fetch` options: `cache`/`next.revalidate`/`next.tags` have no effect in proxy.

### Why not rely on proxy for security
- A matcher gap or refactor can silently remove coverage.
- Server Functions are POSTs to the route where they're used, so excluding a path from the matcher also skips Server Function calls there.
- It runs before rendering, so it can't make fine-grained, per-resource decisions.
Use it as a fast first line, with real verification in a data access layer and inside Server Actions and Route Handlers.

## Follow-ups
- **Can proxy read the request body?** — It can with caveats; avoid large bodies.
- **What replaced `NextResponse.next({ request: { headers } })`?** — Still available, to pass modified request headers to the app.

## Common Mistakes
- No matcher, so it runs on `_next/static` and images.
- Treating proxy as the auth layer.
- Using dynamic matcher values.

## Tips
- Mention the rename and the Node.js default runtime; they're the interview-relevant changes.
