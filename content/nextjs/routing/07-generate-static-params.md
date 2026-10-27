---
title: "How does generateStaticParams work, and what happens to paths you didn't return?"
level: hard
type: implement
tags: [generate-static-params, ssg, isr, dynamic-params, cache-components]
related: [nextjs/dynamic-catch-all-segments, nextjs/ssr-ssg-isr-csr, nextjs/time-vs-on-demand-revalidation, nextjs/app-shell-partial-prerendering]
---

## Question
You have `app/products/[category]/[id]/page.tsx` for an e-commerce site with 50,000 products. Prerender the 100 best-sellers at build time, render the rest on first visit, and refresh product data hourly.

1. Implement it **without** Cache Components (the model most Next 13–15 codebases use).
2. Implement it **with** Cache Components (Next 16).
3. Explain what a visitor sees for a product that wasn't prerendered, and how you'd 404 unknown products in each model.

## Clues
- `generateStaticParams` replaces `getStaticPaths`. What did `fallback` do there, and what replaces it in the App Router?
- In the previous model, the route-level `revalidate` export turns SSG into ISR.
- With Cache Components, `dynamicParams` and `revalidate` exports are gone; the lifetime lives in `cacheLife`, and an empty array is an error.

## Interview Answer
`generateStaticParams` runs at build time and returns the list of param objects to prerender, one object per URL, including every dynamic segment in the route. Any path not in the list is rendered on its first request and then cached, which is ISR. In the previous model I return the top 100 products, set `export const revalidate = 3600` for hourly time-based regeneration, and leave `dynamicParams` at its default `true`; setting it to `false` would 404 everything not listed. With Cache Components there's no `revalidate` or `dynamicParams` export: I move the fetch into a `'use cache'` function with `cacheLife('hours')`, must return at least one param, and call `notFound()` myself for unknown products. With Partial Prefetching enabled, an unlisted product is served the route's App Shell instantly while the real page renders in the background and is cached for the next visitor.

## Explanation
### 1. Previous model (no Cache Components)

```tsx
// app/products/[category]/[id]/page.tsx
import { notFound } from 'next/navigation'

type Product = { id: string; category: string; name: string; price: number }

// ISR: regenerate each prerendered page at most once per hour
export const revalidate = 3600

// true (default): unlisted params render on demand, then get cached
// false: unlisted params 404
export const dynamicParams = true

export async function generateStaticParams() {
  const top: Product[] = await fetch('https://api.shop.com/products?sort=sales&limit=100')
    .then((r) => r.json())

  // One object per URL; must include EVERY dynamic segment
  return top.map((p) => ({ category: p.category, id: p.id }))
}

export default async function ProductPage(props: PageProps<'/products/[category]/[id]'>) {
  const { category, id } = await props.params
  const res = await fetch(`https://api.shop.com/products/${category}/${id}`, {
    next: { revalidate: 3600, tags: [`product-${id}`] },
  })
  if (!res.ok) notFound()
  const product: Product = await res.json()

  return <h1>{product.name} · ₹{product.price}</h1>
}
```

What happens:

```txt
next build      → 100 HTML + RSC payloads written
/products/a/42  → served from cache (HIT)
after 1h        → next request gets stale page, regeneration runs in background
/products/b/999 → not prerendered: rendered on first request (blocking), then cached
```

Notes:
- Returning `[]` (or using `dynamic = 'force-static'`) prerenders nothing at build time and renders every path on demand. This is useful when the catalogue is huge and builds must stay fast.
- If you *don't export* `generateStaticParams` at all, the route is fully dynamic.
- `generateStaticParams` is **not** re-run during revalidation. New products appear through on-demand rendering, not through a rebuild of the list.

### 2. Cache Components (Next 16)

```tsx
// app/products/[category]/[id]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'

async function getProduct(category: string, id: string) {
  'use cache'
  cacheLife('hours')           // replaces `revalidate = 3600`
  cacheTag(`product-${id}`)    // for updateTag/revalidateTag on edits
  const res = await fetch(`https://api.shop.com/products/${category}/${id}`)
  return res.ok ? res.json() : null
}

export async function generateStaticParams() {
  const top = await getTopProducts() // also 'use cache'
  // Must return at least ONE param: an empty array is a build error
  return top.map((p: { category: string; id: string }) => ({ category: p.category, id: p.id }))
}

export default function ProductPage(props: PageProps<'/products/[category]/[id]'>) {
  return (
    <main>
      <Header /> {/* static: part of the App Shell */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails params={props.params} />
      </Suspense>
    </main>
  )
}

async function ProductDetails({ params }: Pick<PageProps<'/products/[category]/[id]'>, 'params'>) {
  const { category, id } = await params // awaited INSIDE Suspense
  const product = await getProduct(category, id)
  if (!product) notFound()           // replaces dynamicParams = false
  return <h1>{product.name} · ₹{product.price}</h1>
}
```

What changed and why:

| Previous model | Cache Components |
|---|---|
| `export const revalidate = 3600` | `cacheLife('hours')` inside `'use cache'` |
| `fetch(..., { next: { tags } })` | `cacheTag(...)` |
| `dynamicParams = false` | Not supported (build error); call `notFound()` |
| `return []` allowed | Must return ≥ 1 param (build-time validation needs a sample) |
| Unlisted path blocks on first request | With Partial Prefetching: App Shell served instantly, page upgraded in background |

Why await `params` inside `<Suspense>`? With Partial Prefetching on, it lets Next.js produce a URL-independent App Shell (header plus skeleton) that can be served for any unknown product immediately. Without Partial Prefetching, the docs say to await `params` *outside* Suspense so that Next.js still creates a per-URL ISR entry for unlisted paths.

### 3. Build-time validation caveat
With Cache Components, the build renders the route with your sample params and fails if something reads `cookies()` or uncached data outside `<Suspense>`. But it only validates the code paths that run for those samples. A branch taken only for other params is validated on its first real request.

### Nested segments
A layout at `[category]` can export its own `generateStaticParams`; the child's function then runs once per parent result and receives `{ params: { category } }` synchronously. A page can also generate both segments at once (bottom-up), as shown above.

## Follow-ups
- **How do you update one product immediately after an admin edits it?** — In the Server Action, call `updateTag('product-42')` (read-your-own-writes). From a CMS webhook Route Handler, call `revalidateTag('product-42', 'max')`.
- **Does `fetch` inside `generateStaticParams` and the page run twice?** — No. `fetch` is memoized across `generateStaticParams`, layouts and pages within a build pass.
- **How is this different from `getStaticPaths`?** — Same idea, simpler shape: return `[{ id }]` instead of `{ paths: [{ params: { id } }], fallback }`. `dynamicParams` replaces `fallback`.

## Common Mistakes
- Returning `{ id }` for a route that also has `[category]`, so the param set is incomplete.
- Expecting `generateStaticParams` to re-run on revalidation and pick up new items.
- Keeping `dynamicParams`/`revalidate` exports after enabling `cacheComponents`. Both fail the build.
- Returning `[]` with Cache Components.

## Tips
- Frame it as **"which URLs at build time, what happens to the rest, how they stay fresh"**. Those three axes cover every variant interviewers ask.
- Name the Pages Router mapping: `getStaticPaths` → `generateStaticParams`, `fallback` → `dynamicParams`, `revalidate` in `getStaticProps` → segment `revalidate` → `cacheLife`.
