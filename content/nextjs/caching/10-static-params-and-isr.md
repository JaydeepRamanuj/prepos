---
title: "generateStaticParams and ISR for a large catalogue: prerender a subset, serve the rest on demand"
level: hard
type: design
tags: [generateStaticParams, dynamicParams, isr, cache-components, app-shell, scale]
related: [nextjs/generate-static-params, nextjs/time-vs-on-demand-revalidation, nextjs/use-cache-and-cache-life, nextjs/app-shell-partial-prerendering]
---

## Question
You have 200,000 product pages that change occasionally. Building all of them takes too long. How do you configure `generateStaticParams`, Suspense and revalidation so popular pages are fast, the rest still work, and edits propagate? How does this differ with and without Cache Components?

## Clues
- You don't have to prerender everything at build time.
- Unlisted params can be rendered on demand and then stored.
- With Cache Components, the `dynamicParams` route config is not available.
- Where you `await params` decides whether an unlisted URL can get an instant shell.

## Interview Answer
I prerender only what matters: `generateStaticParams` returns the top few thousand slugs, so the build stays short. With Cache Components and partial prefetching, a visit to a listed URL is served fully prerendered from the cache, while a visit to an unlisted URL gets the route's app shell instantly, with the URL-specific content streaming in behind Suspense, after which the completed result is stored in the ISR cache for later visits. That works because I don't `await params` at the top of the layout or page; I pass the promise down and await it inside a `<Suspense>` boundary. Product data lives in a `"use cache"` function tagged `product-${slug}` with a `cacheLife`, and admin edits call `updateTag` while CMS webhooks call `revalidateTag(tag, 'max')`. With Cache Components, `generateStaticParams` must return at least one param, and `dynamicParams` isn't available. In the previous model, `dynamicParams = true` is the default, and `false` turns unknown slugs into 404s.

## Explanation
### Implementation (Cache Components + partial prefetching)

```tsx
// app/products/[slug]/page.tsx
export async function generateStaticParams() {
  const top = await getTopProductSlugs(2000);        // light, bounded query
  return top.map((slug) => ({ slug }));              // must return at least one entry
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <Product params={params} />                    {/* await happens inside the boundary */}
    </Suspense>
  );
}

async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  return <ProductView product={product} />;
}

async function getProduct(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(`product-${slug}`);
  return db.product.findUnique({ where: { slug } });
}
```

### Behaviour by request

| Request | Result |
|---|---|
| Slug returned by `generateStaticParams` | param-specific prerender served from the cache |
| Unlisted slug | app shell served at once; product content renders and streams; completed result stored in the ISR cache |
| Invalid slug | `notFound()` 404 UI (note the status-code caveat for streamed content) |
| Edited product | tag invalidation refreshes the entry; next visit gets fresh content |

Without partial prefetching, awaiting `params` inside `Suspense` makes Next.js keep serving the shared fallback instead of creating a URL-specific ISR entry; in that mode await `params` outside any Suspense (including a `loading.tsx` boundary) so the first request for an unlisted path waits for the render.

### Without Cache Components (previous model)

```tsx
export const dynamicParams = true;   // default: unknown params render on demand and are cached
export const revalidate = 3600;      // ISR interval
```

| Option | Effect |
|---|---|
| `dynamicParams = true` | unlisted params are generated on first request |
| `dynamicParams = false` | unlisted params return 404 |

`dynamicParams` is not available when Cache Components is enabled.

### Revalidation flows
- **Admin edit**: `updateTag('product-123')` in the Server Action.
- **CMS publish**: webhook → Route Handler → `revalidateTag('product-123', 'max')`.
- **Safety net**: `cacheLife("days")`.
- **Bulk changes**: also tag by category.

### Build performance
- Keep `generateStaticParams` fast; do not do per-item heavy fetches.
- Nested dynamic segments: a child's `generateStaticParams` receives the parent's params, so popular products can be listed per category.
- Static generation concurrency and retries are configurable in `next.config` (`staticGeneration*` options).

### Pitfalls
1. Returning 200k params and timing out the build.
2. Returning an empty array with Cache Components (build error).
3. Using `dynamicParams = false` in the old model and getting 404s for newly published products.
4. Streamed `notFound()` gives a 200 status with `noindex`; check existence before streaming if status codes matter.
5. Serverless in-memory caches may not persist; prerendered and ISR output is stored by the platform.
6. User-controlled params used as tags or cache keys: validate them.

## Follow-ups
- **How would you pick the popular slugs?** — Analytics or recent sales; refresh the list periodically.
- **Pages Router equivalent?** — `getStaticPaths` with `fallback: true` or `'blocking'` plus `revalidate`.

## Common Mistakes
- Prerendering everything.
- Awaiting `params` at the top of the layout, which prevents an instant shell.
- Mixing `dynamicParams` with Cache Components.

## Tips
- State the three knobs: which params are listed, what happens to the rest, how edits propagate.
