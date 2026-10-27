---
title: "Plan an incremental migration from the Pages Router to the App Router"
level: advanced
type: scenario
tags: [migration, pages-router, app-router, incremental, risk, rollout]
related: [nextjs/app-router-vs-pages-router, nextjs/server-vs-client-components, nextjs/optimistic-auth-checks-proxy, nextjs/data-access-layer]
---

## Question
You inherit a 200-route Pages Router app with `getServerSideProps`, API routes, a custom `_app` with providers, `next-auth`, SWR, and CSS Modules. Leadership wants the benefits of the App Router without a rewrite freeze. Propose a migration plan, ordering, risks and how you'd measure success.

## Clues
- Both routers can coexist; each URL belongs to one of them.
- Start with low-risk, high-value routes.
- Providers, auth and data fetching conventions are the cross-cutting concerns.

## Interview Answer
I'd migrate incrementally, route by route, keeping both routers running. First, upgrade Next.js and React and fix deprecations, because the App Router features I want depend on current versions. Then add `app/layout.tsx` to replace `_app` and `_document` (fonts, global CSS, providers wrapped in a small `"use client"` component), keeping providers shared. Migrate low-risk static or read-mostly routes first (marketing, docs, blog) and convert `getStaticProps`/`getServerSideProps` to async Server Components with the new caching model; move the highest-value routes next (product pages, dashboards) using streaming and Suspense. Replace `next/head` with the Metadata API, `next/router` with `next/navigation`, and API routes with Route Handlers or Server Actions gradually. Auth moves to a DAL pattern plus proxy, and SWR remains in client leaves. I'd measure per route: Web Vitals, bundle size, error rate, and developer velocity, and keep rollback simple by migrating one route per PR behind the same URL.

## Explanation
### Phases

| Phase | Work | Risk |
|---|---|---|
| 0. Prep | upgrade Next/React/Node; fix deprecations; add e2e tests for critical flows; baseline metrics | low |
| 1. Foundation | `app/layout.tsx`, global CSS, fonts, `Providers` client wrapper, shared components; auth session helper usable from both routers | medium |
| 2. Pilot | migrate 2–3 simple routes (static content), validate build/deploy, analytics, SEO, redirects | low |
| 3. Core routes | convert data-heavy pages, introduce DAL and caching strategy (`use cache`/tags), streaming skeletons | medium-high |
| 4. Mutations | forms → Server Actions with validation and auth; API routes for external consumers → Route Handlers | medium |
| 5. Cleanup | remove `pages/`, `_app`, `_document`, legacy helpers, old data fetching libs where redundant | low |

### Conversion cheat sheet

```tsx
// Pages: pages/products/[id].tsx
export async function getServerSideProps({ params }) {
  const product = await getProduct(params.id);
  return { props: { product } };
}
export default function Page({ product }) { return <ProductView product={product} />; }

// App: app/products/[id]/page.tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);       // server only; add "use cache" where shareable
  return <ProductView product={product} />;
}
```

| Pages Router | App Router |
|---|---|
| `getStaticProps` / `getStaticPaths` | async component + `"use cache"`; `generateStaticParams` |
| `getServerSideProps` | async component reading runtime APIs behind Suspense |
| `next/head` | `metadata` / `generateMetadata` |
| `next/router` (`useRouter`) | `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) |
| `_app.tsx` providers | root `layout.tsx` + client `Providers` |
| API routes `pages/api/*` | `route.ts` Route Handlers; Server Actions for UI mutations |
| `getInitialProps` | remove |
| middleware | `proxy.ts` (shared across routers) |

### Cross-cutting concerns
- **Providers**: React context needs client wrappers; keep them above `children` so pages stay Server Components.
- **Auth**: `next-auth` (Auth.js) supports both routers; unify session access through a DAL helper; protect Server Actions and handlers.
- **Data fetching**: SWR/React Query remain valid in Client Components; consider initial data from Server Components.
- **Styling**: CSS Modules work in both; CSS-in-JS runtime libraries (styled-components, emotion) need registry setup and a `"use client"` boundary, or migration to CSS Modules/Tailwind.
- **State libs**: Zustand/Redux stores must live in client components, per-request instances on the server if used with SSR to avoid cross-request leaks.
- **i18n**: built-in i18n routing from Pages doesn't exist in App Router; use route segments (`[locale]`) and proxy.
- **Analytics & error monitoring**: update page-view tracking (`usePathname` effects) and Sentry config.

### Gotchas
- A URL can't exist in both routers; switch routes atomically.
- Differences in caching defaults; test freshness behaviour explicitly.
- `window` use in components now rendered on the server can fail; add `"use client"` or guard.
- SEO: preserve URLs, metadata, canonical tags, structured data; run a crawl comparison.
- Redirects/rewrites in `next.config` remain.
- Bundle size may initially increase if everything is marked `"use client"`; push boundaries down.

### Measuring success
Core Web Vitals and TTFB per migrated route, JS shipped per route, error rates, build times, developer satisfaction, deploy frequency, and a reduction in client-side data fetching waterfalls.

### Rollout safety
Feature-flag or deploy route by route; keep e2e smoke tests; use preview deployments and canary traffic; maintain a rollback path (revert the route's PR).

## Follow-ups
- **Should I rewrite everything to Server Components right away?** — No; start with `"use client"` where needed, then push boundaries down iteratively.
- **How long does it take?** — Depends on size; the incremental approach lets teams ship features while migrating.

## Common Mistakes
- Big-bang rewrite.
- Marking whole pages `"use client"` and calling it migrated.
- Ignoring SEO parity.

## Tips
- Lead with "incremental, route by route, measurable".
