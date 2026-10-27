---
title: "SSR, SSG, ISR, CSR: what do they mean in modern Next.js?"
level: medium
type: concept
tags: [ssr, ssg, isr, csr, prerendering, cache-components, rendering]
related: [nextjs/server-vs-client-components, nextjs/app-shell-partial-prerendering, nextjs/time-vs-on-demand-revalidation, nextjs/streaming-suspense]
---

## Question
Explain SSR, SSG, ISR and CSR. How do they map onto the App Router in Next.js 16 with Cache Components, where the boundary between static and dynamic is per component rather than per route?

## Interview Answer
SSG generates HTML at build time and serves it from a CDN; SSR generates HTML on the server for every request; ISR is SSG that regenerates in the background after a time or on demand; CSR sends a minimal shell and builds the UI in the browser with JavaScript. In the older model each page picked one, via `getStaticProps` or `getServerSideProps`, and in early App Router the route was static or dynamic depending on APIs it touched. With Cache Components in Next.js 16 the boundary moves down to components: at build time Next.js prerenders a static shell with everything it can complete, which includes `"use cache"` results; request-time pieces, like cookie-dependent UI or uncached fetches, sit behind `<Suspense>` and stream in per request. So one page can be SSG for its shell, ISR-like for cached parts via `cacheLife` and tags, SSR for streamed parts, and CSR for interactive client logic. I choose per piece of content, not per route.

## Explanation
### The four classic strategies

| Strategy | When HTML is produced | Fresh data | Good for |
|---|---|---|---|
| SSG | build time | stale until redeploy | marketing, docs |
| SSR | every request | always fresh | personalised or real-time pages |
| ISR | build + background regeneration | stale-while-revalidate | catalogues, blogs |
| CSR | in the browser | fetched after load | dashboards behind login, highly interactive widgets |

### How they map in the App Router (Cache Components on)

```tsx
export default function Page() {
  return (
    <>
      <Header />                                  {/* static: in the shell (SSG) */}
      <Posts />                                    {/* "use cache" + cacheLife: ISR-like */}
      <Suspense fallback={<Skeleton />}>
        <ForYou />                                 {/* reads cookies(): streams per request (SSR) */}
      </Suspense>
      <LiveChart />                                {/* "use client": hydrates, fetches in browser (CSR) */}
    </>
  );
}

async function Posts() {
  "use cache";
  cacheLife("hours");
  cacheTag("posts");
  return <List items={await getPosts()} />;
}
```

- **Static shell**: HTML plus RSC payload, producible at build time and served from a CDN.
- **Cached**: `use cache` output can join the shell if its `stale` time is long enough; it revalidates by time or with `revalidateTag`/`updateTag`.
- **Dynamic**: reading `cookies()`, `headers()`, `searchParams`, or uncached I/O needs request time, so it must be wrapped in `Suspense` or cached; Next.js reports a "blocking route" otherwise.
- **Client**: Client Components still server-render for the first paint and then hydrate.

### Legacy vs current mapping

| Old (Pages / early App Router) | Now |
|---|---|
| `getStaticProps` | static shell + `use cache` |
| `getServerSideProps` | runtime APIs behind `Suspense` |
| `revalidate: 60` | `cacheLife({ revalidate: 60 })` |
| `dynamic = 'force-dynamic'` | not needed: stream dynamic parts; route segment configs like `dynamic`/`revalidate` are not used with Cache Components |
| `getStaticPaths` | `generateStaticParams` |

### Choosing

1. Same for everyone and rarely changes → static or `use cache` with a long `cacheLife`.
2. Same for everyone but changes → `use cache` + tags + on-demand revalidation.
3. Per user or per request → stream behind `Suspense`; cache by passing extracted values (such as a session id) as arguments to a cached function.
4. Interactive → Client Component; fetch with a query library only if the data is client-driven.

### CSR is not "bad"
Authenticated apps behind a login often gain little from SEO-driven SSR; a static shell plus client data is fine. The cost is waterfalls and larger bundles; Server Components remove most of that.

## Follow-ups
- **Is ISR still a thing?** — Yes, expressed as `cacheLife` revalidation plus tags; the docs also call it revalidation.
- **Does a Client Component render on the server?** — Yes, for the initial HTML; then it hydrates.

## Common Mistakes
- Treating "dynamic" as all-or-nothing per route.
- Using client fetching for public content that could be cached on the server.
- Omitting `Suspense` around runtime APIs.

## Tips
- Say "per component, not per route" and give the four-layer example.
