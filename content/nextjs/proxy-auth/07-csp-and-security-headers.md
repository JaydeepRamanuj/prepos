---
title: "How do you set security headers and a nonce-based CSP in Next.js?"
level: advanced
type: design
tags: [csp, security-headers, nonce, proxy, xss, next-config]
related: [nextjs/proxy-ts-replaces-middleware, nextjs/runtime-apis-dynamic-rendering, browser-security/csp-xss-basics]
---

## Question
Your security team wants a strict Content Security Policy and standard security headers. How do you implement them in Next.js, what is the impact of a nonce on rendering and caching, and how do you roll it out safely?

## Clues
- Static headers can go in `next.config`; per-request nonces need proxy.
- A nonce changes on every request, so the HTML cannot be cached the same way.
- Report-only mode lets you test before enforcing.

## Interview Answer
For static headers like `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` and frame protections, I use the `headers()` config in `next.config.ts`. For a strict CSP I generate a random nonce per request in `proxy.ts`, put it in the `Content-Security-Policy` header with `script-src 'self' 'nonce-…' 'strict-dynamic'`, and pass it to the app in a request header (`x-nonce`) so Next.js applies it to its own scripts and I can use it for my inline scripts. The trade-off is that a nonce requires dynamic rendering: static pages and CDN-cached HTML can't carry a per-request value, so nonce-based CSP forces request-time rendering for the pages it covers (hash-based or `unsafe-inline` policies, or Subresource Integrity, are alternatives). I roll out with `Content-Security-Policy-Report-Only` first, watch violation reports, fix third-party scripts, then enforce.

## Explanation
### Static headers in config

```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },                   // or CSP frame-ancestors
];

export default {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
```

### Nonce-based CSP in proxy

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);                 // Next reads the request CSP to nonce its scripts

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [{
    source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
    missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
  }],
};
```

Read the nonce in a Server Component when adding your own inline script:

```tsx
import { headers } from "next/headers";
import Script from "next/script";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="https://analytics.example/a.js" strategy="afterInteractive" nonce={nonce} />
      </body>
    </html>
  );
}
```

### Consequences of nonces
- Every request needs a unique nonce, so pages are rendered per request (reading `headers()` makes them request-time); they cannot be served as shared static HTML from a CDN with the nonce baked in.
- With Cache Components, put the nonce-dependent parts behind Suspense or accept request-time shells for those routes.
- Partial prerendering/ISR don't combine with a per-request nonce unless the platform supports it.
- Alternatives: hash-based CSP (static pages, stable inline scripts), `'self'` + external scripts only, or Subresource Integrity (experimental in Next.js) for static builds.

### Rollout plan
1. Ship `Content-Security-Policy-Report-Only` with a `report-to`/`report-uri` endpoint.
2. Triage violations: analytics, tag managers, chat widgets, fonts, images.
3. Replace inline handlers and `eval`.
4. Enforce on a small percentage or staging first.
5. Keep dev relaxations (`unsafe-eval` for React dev tools) out of production.

### Other headers and checks
- `frame-ancestors` supersedes `X-Frame-Options` for modern browsers.
- Trusted Types (`require-trusted-types-for 'script'`) hardens DOM sinks.
- Cookies: `HttpOnly`, `Secure`, `SameSite`.
- Validate and sanitise user HTML; CSP is defence in depth, not a substitute.

## Follow-ups
- **Why `strict-dynamic`?** — It lets nonced scripts load others without allow-listing hosts.
- **Does CSP apply to `next/image`?** — Image `src` falls under `img-src`.

## Common Mistakes
- Using `unsafe-inline` and calling it strict.
- Forgetting prefetch requests in the matcher.
- Breaking third-party scripts without a report-only phase.

## Tips
- Name the nonce/caching trade-off; it shows you understand the rendering implications.
