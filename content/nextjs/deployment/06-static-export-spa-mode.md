---
title: "Static export and SPA mode in Next.js: what works, what doesn't, and when to choose it"
level: medium
type: concept
tags: [static-export, output-export, spa, cdn, github-pages, limitations]
related: [nextjs/next-config-essentials, nextjs/vercel-vs-self-hosting, nextjs/ssr-ssg-isr-csr]
---

## Question
You need to host a Next.js app on S3 or GitHub Pages without a Node server. How do you configure a static export, what features stop working, and how do you handle dynamic data and routes?

## Interview Answer
Setting `output: "export"` in `next.config` makes `next build` generate a folder of static HTML, JavaScript and assets (`out/`) that any static host or CDN can serve. Server Components still work, but they render once at build time. Anything needing a running server is unsupported: dynamic routes without `generateStaticParams`, `dynamicParams` on-demand generation, cookies and request-dependent route handlers, rewrites, redirects, headers and proxy from `next.config`, ISR, Server Actions, draft mode, intercepting routes, and the default image optimiser (you need a custom loader or `unoptimized`). Data that changes must be fetched on the client after load, with a query library, or you rebuild and redeploy on content changes. I choose export for documentation, marketing and mostly static sites, or Capacitor/Electron-style bundles, and a Node/serverless deployment when I need server features.

## Explanation
### Configure

```ts
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },        // or a custom loader (Cloudinary, imgix)
  trailingSlash: true,                  // /about/ -> about/index.html (friendlier for static hosts)
};
export default config;
```

`next build` writes `out/`. Deploy `out/` to any static host. Pages Router and App Router are both supported.

### Dynamic routes must be fully enumerated

```tsx
// app/posts/[slug]/page.tsx
export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.slug }));   // every page built now
}
// A slug not returned here -> 404 on the static host (no on-demand generation)
```

### What changes with Server Components
They execute at build time; their output is HTML plus RSC payload files used for client navigation. Fetches run during the build, so data is frozen until the next build. Client Components hydrate in the browser as usual.

### Unsupported features (summary)

| Unsupported | Alternative |
|---|---|
| Server Actions, mutations | call an external API from the client |
| Route Handlers that read the request (POST etc.) | external backend / serverless functions; `GET` handlers can be pre-rendered to files |
| `cookies()`, `headers()`, request-time APIs | client-side logic / external services |
| Redirects, rewrites, headers in `next.config` | host-level rules (S3 routing, Netlify `_redirects`, CloudFront functions) |
| Proxy | CDN edge functions |
| ISR / revalidation | rebuild on content change (webhook-triggered CI) |
| Default image optimisation | custom `loader`, pre-optimised images, `unoptimized` |
| Dynamic params without static list | `generateStaticParams` or client-side routing |
| Draft mode, intercepting routes | — |

### Handling dynamic data
- Fetch on the client after load (SWR/TanStack Query) from a public API, with proper CORS.
- Use build-time fetching and trigger rebuilds via CMS webhooks.
- For per-user data, authenticate in the browser (token in memory or secure cookies from a separate API domain).

### Hosting details
- Deep links: configure the host to serve `index.html`/`404.html` correctly. With `trailingSlash: false` the export creates `about.html`; hosts need to map `/about` to it.
- Cache headers: hashed assets under `_next/static/` can be cached forever; HTML should be short-lived or revalidated.
- Using a `basePath` for GitHub Pages project sites (`/repo-name`), and `assetPrefix` for CDN origins.
- No `next start`; test locally with a static server (`npx serve out`).

### SPA mode
Next.js also supports single-page-app patterns: a static shell with client-side routing and data fetching, optionally with a catch-all route. The guide covers using `use()` with promises passed through context for client data, and keeping the app shell static while rendering routes client-side. This forfeits SSR benefits (SEO, first-paint with data) so use it only when the product is authenticated app-like and SEO isn't important.

### When to choose
- Docs/marketing/blog with infrequent changes → export or normal static generation on a platform.
- Needs previews, ISR, auth, Server Actions → server/serverless deployment.

## Follow-ups
- **Does a static export still use React Server Components?** — Yes at build time.
- **Why does `next/image` fail?** — The default loader needs a server; use a custom loader or `unoptimized`.

## Common Mistakes
- Using Server Actions in an exported app.
- Forgetting host-level redirect/rewrite configuration.
- Missing `generateStaticParams` for dynamic routes.

## Tips
- List unsupported features by category (server APIs, config routing, ISR, images) rather than from memory.
