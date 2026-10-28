---
title: "App Router vs Pages Router: what changed and how would you migrate?"
level: medium
type: concept
tags: [app-router, pages-router, migration, server-components, data-fetching]
related: [nextjs/app-router-file-conventions, nextjs/server-vs-client-components, nextjs/ssr-ssg-isr-csr, nextjs/fetching-in-server-components]
---

## Question
Compare the Pages Router with the App Router. What are the main differences in data fetching, layouts, rendering and APIs, and how would you migrate an existing Pages app incrementally?

## Interview Answer
The Pages Router maps files in `pages/` to routes, fetches data with page-level functions like `getServerSideProps` and `getStaticProps`, and every component is a client component that hydrates. The App Router, built on React Server Components, maps folders in `app/` with `page.tsx`, `layout.tsx` and friends; components are Server Components by default, data is fetched with `async`/`await` directly in components, and layouts persist across navigations and can nest. Streaming with Suspense, per-segment `loading.tsx` and `error.tsx`, Server Actions for mutations, route handlers instead of API routes, and the Metadata API are App Router features. Both routers can coexist in one project, so migration can be incremental: move routes one at a time, starting with simple ones, and share components; conflicting paths aren't allowed, and `_app`/`_document` map to the root layout.

## Explanation
### Comparison

| Concern | Pages Router | App Router |
|---|---|---|
| Routing | file = route in `pages/` | folder + `page.tsx` in `app/` |
| Components | client by default (SSR + hydrate) | Server by default; `"use client"` opt-in |
| Layouts | `_app.tsx`, manual per-page `getLayout` | nested `layout.tsx` that persists; `template.tsx` |
| Data | `getStaticProps`, `getServerSideProps`, `getStaticPaths` | `async` components, `fetch`, `"use cache"`, `generateStaticParams` |
| Mutations | API routes + client `fetch` | Server Actions, Route Handlers |
| Loading UI | manual | `loading.tsx`, Suspense streaming |
| Errors | `_error.tsx`, `404.tsx` | `error.tsx`, `not-found.tsx`, `global-error.tsx` |
| API endpoints | `pages/api/*` | `app/**/route.ts` |
| Metadata | `next/head` | `metadata` / `generateMetadata` |
| Middleware | `middleware.ts` (renamed `proxy.ts` in Next 16) | same file convention |
| Head / document | `_document.tsx` | root `layout.tsx` (`<html>`, `<body>`) |

### Data fetching, side by side

```tsx
// Pages Router
export async function getServerSideProps() {
  const posts = await getPosts();
  return { props: { posts } };
}
export default function Page({ posts }) { return <List posts={posts} />; }

// App Router
export default async function Page() {
  const posts = await getPosts();      // runs on the server, never ships to the client
  return <List posts={posts} />;
}
```

### Mental model changes
- Interactivity moves to small Client Components at the leaves.
- Props from server to client must be serialisable.
- Caching is explicit; in Next 16 with Cache Components you opt in with `"use cache"` rather than relying on implicit fetch caching.
- Hooks like `useRouter` come from `next/navigation` (not `next/router`); `useSearchParams`, `usePathname` and `useParams` replace router fields.
- `params` and `searchParams` are Promises in recent versions.

### Incremental migration plan
1. Upgrade Next.js and React; fix deprecations.
2. Create `app/layout.tsx` (replacing `_app` and `_document`): fonts, global CSS, providers wrapped in a Client Component.
3. Move routes gradually: one route exists in either `pages/` or `app/`, not both.
4. Convert data functions into async Server Components; move `pages/api` handlers to route handlers when convenient.
5. Replace `next/head` with the Metadata API.
6. Replace `next/router` with `next/navigation` in migrated code.
7. Add `"use client"` where hooks and handlers are needed; push the boundary down.
8. Remove `pages/` when empty.

### When to stay on Pages
Stable apps with heavy reliance on `getServerSideProps` patterns and libraries not yet RSC-compatible. The Pages Router is still supported, but new features (Cache Components, Server Actions, streaming) are App Router first.

## Follow-ups
- **Can both routers coexist?** — Yes; they share `public/` and config, but cannot define the same URL.
- **What replaces `getStaticPaths`?** — `generateStaticParams`.

## Common Mistakes
- Marking everything `"use client"` during migration.
- Importing `next/router` in the App Router.
- Expecting `getServerSideProps` semantics (per-request) to be default; static is default.

## Tips
- Offer the incremental migration steps; it shows practical experience.
