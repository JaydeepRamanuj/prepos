---
title: "Partial Prerendering and the app shell: what ends up in the static shell?"
level: advanced
type: concept
tags: [ppr, cache-components, app-shell, static-shell, partial-prefetching]
related: [nextjs/streaming-suspense, nextjs/use-cache-and-cache-life, nextjs/dashboard-partial-personalization, nextjs/prefetching-and-router-cache]
---

## Question
What is Partial Prerendering in Next.js 16 with Cache Components? What decides whether something is part of the static shell, and how does it affect navigations and prefetching?

## Clues
- Next.js prerenders the route at build time as far as it can.
- Anything that needs request data must have a fallback.
- `cacheLife` timings affect whether cached content can be baked into the shell.

## Interview Answer
Partial Prerendering means one route is both static and dynamic: at build time Next.js renders the component tree up to the points where it needs request-time information, producing a static shell of HTML plus RSC payload that a CDN can serve instantly, and the dynamic holes, marked by `<Suspense>` fallbacks, are streamed in per request. What goes in the shell: synchronous and pure work, module imports, `"use cache"` results (when their lifetime is long enough to be useful in a shell), and the fallbacks. What can't: `cookies()`, `headers()`, `searchParams`, unresolved dynamic `params`, uncached fetches and random or time values, unless they're cached, moved behind a `connection()` plus Suspense, or given known values via `generateStaticParams`. Next.js validates this: if something dynamic isn't covered it reports a blocking-route error. For navigations, with partial prefetching a `<Link>` prefetches a per-route app shell rather than the full page, so client transitions show the shell instantly while the remainder streams.

## Explanation
### What goes where

| Kind of work | Where it lands |
|---|---|
| Static JSX, imports, pure computation | static shell |
| `"use cache"` with `cacheLife` (stale ≥ ~5 min) | static shell (refreshed on revalidation) |
| `"use cache"` with very short lifetime (e.g. `seconds`) | excluded from the shell; runs at request time |
| `cookies()`, `headers()`, `searchParams`, dynamic `params` | request time, behind `Suspense` |
| Uncached `fetch`/DB read | request time, behind `Suspense` |
| `Math.random()`, `Date.now()` | cache it or `await connection()` + `Suspense` |

### Example: product page

```tsx
export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <>
      <Nav />                                               {/* static */}
      <Suspense fallback={<ProductSkeleton />}>
        <Product params={params} />                         {/* reads params (not pre-generated) */}
      </Suspense>
      <Suspense fallback={<CartSkeleton />}>
        <Cart />                                            {/* cookies(): per user */}
      </Suspense>
    </>
  );
}

async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetails slug={slug} />;
}

async function ProductDetails({ slug }: { slug: string }) {
  "use cache";
  cacheLife("hours");
  cacheTag(`product-${slug}`);
  return <Details data={await getProduct(slug)} />;
}
```

With `generateStaticParams` returning popular slugs, the shell for those pages contains the real product markup; unknown slugs get the generic shell and stream the product in.

### Maximising the shell
Don't `await params` or `cookies()` at the top of a layout: that makes everything under it runtime-dependent. Pass the promise down (or read it in a leaf) and `await` inside a Suspense boundary. The deeper the dynamic access, the more static content ships instantly.

### Navigation and prefetching
- **Direct visit**: CDN returns the static shell HTML; dynamic parts stream.
- **Client navigation**: only the segments below the shared layout re-render; suspense boundaries above that point don't trigger, so put boundaries below shared layouts if you want instant fallbacks.
- **Partial prefetching** (`partialPrefetching: true`): `<Link>` prefetches the route's app shell by default, enough to show the page frame immediately. `prefetch={true}` additionally resolves per-link URL data.
- Cached content in the shell also feeds the client cache using the `stale` value (client minimum 30 s).

### Enabling
```ts
// next.config.ts
const nextConfig = { cacheComponents: true, partialPrefetching: true };
export default nextConfig;
```
New apps from `create-next-app` have these on.

### Trade-offs
- Needs streaming-capable hosting and cache coordination across instances.
- Mental overhead: you must reason about what's static, cached or dynamic, but the dev overlay's insights guide you.
- Runtime `use cache` entries with the default in-memory handler may not survive between serverless requests; build-time caching works normally.

## Follow-ups
- **How is this different from the old `experimental.ppr`?** — Cache Components replaced the experimental flag as the model: opt-in caching with `use cache`, explicit Suspense, validated at build.
- **Can I test that navigation is instant?** — Yes; Next.js has instant-navigation tooling and the guide recommends e2e tests asserting the shell.

## Common Mistakes
- Awaiting runtime APIs at the top of the layout.
- Assuming every `use cache` goes into the shell regardless of `cacheLife`.
- Forgetting the Suspense fallback must match layout size.

## Tips
- Walk through a product page: what is static, cached, and streamed.
