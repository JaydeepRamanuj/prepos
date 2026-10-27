---
title: "Design a page that is mostly static but personalised for signed-in users"
level: advanced
type: design
tags: [personalization, ppr, cache-components, suspense, cookies, e-commerce]
related: [nextjs/app-shell-partial-prerendering, nextjs/runtime-apis-dynamic-rendering, nextjs/use-cache-and-cache-life, nextjs/data-access-layer]
---

## Question
A product listing page is identical for everyone except a header cart badge, "recently viewed" strip and per-user prices. Design the rendering and caching so the page is fast and cacheable at the CDN, while personalisation is correct and doesn't leak between users.

## Clues
- Separate what's shared from what's per user.
- Per-user data comes from cookies or a session, which are runtime APIs.
- Caches are keyed by arguments, so user identity must never be implicit in a shared cache.

## Interview Answer
I split the page into three layers. The catalogue (products, images, copy) is the same for everyone, so it's in `"use cache"` with a `cacheLife` and tags like `products`, giving it a place in the static shell and on-demand revalidation when the CMS changes. The personal parts, such as the cart badge and "recently viewed", read the session cookie, so they live in components behind `<Suspense>` with skeleton fallbacks that match their size and stream per request. For per-user prices that depend on a segment or plan, I read the cookie outside, extract a coarse key like `plan`, and pass it into a cached function so users on the same plan share cache entries. I never read cookies inside shared cached code, and I authorise inside each data function rather than relying on layout checks. The result is a shell served from the CDN with holes that fill in a few hundred milliseconds later.

## Explanation
### Layers

| Layer | Data | Strategy |
|---|---|---|
| Page frame, nav, footer | static | in the static shell |
| Product grid | shared, changes sometimes | `"use cache"`, `cacheLife("hours")`, `cacheTag("products")` |
| Plan-based prices | shared per plan | cached function taking `plan` as argument |
| Cart badge, recently viewed | per user | runtime, `Suspense`, no shared cache |
| Account menu | per user | runtime, `Suspense` |

### Code sketch

```tsx
export default function Listing() {
  return (
    <>
      <Header cart={<Suspense fallback={<CartBadgeSkeleton />}><CartBadge /></Suspense>} />
      <Products />
      <Suspense fallback={<StripSkeleton />}><RecentlyViewed /></Suspense>
    </>
  );
}

async function Products() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return <Grid items={await getProducts()} />;
}

async function CartBadge() {
  const session = await getSession();                 // reads cookies(): request time
  if (!session) return <LoginLink />;
  const count = await getCartCount(session.userId);   // authorisation inside the DAL
  return <Badge count={count} />;
}

async function Price({ sku }: { sku: string }) {
  const plan = (await getSession())?.plan ?? "free";   // extracted outside the cache
  return <PlanPrice sku={sku} plan={plan} />;
}

async function PlanPrice({ sku, plan }: { sku: string; plan: string }) {
  "use cache";
  cacheLife("minutes");
  return <span>{formatPrice(await getPrice(sku, plan))}</span>;   // key: sku + plan
}
```

### Why this is safe
- Cache keys are generated from arguments; `plan` is explicit, so two plans can never share an entry. Identity isn't implicit.
- Per-user components don't use `use cache`, so user A's data cannot be served to user B.
- Cookies, session checks and DB reads for personal data happen in a data access layer with auth checks.
- `Cache-Control`: personalised responses aren't marked public/shared; the static shell contains only fallbacks.

### Performance outcomes
- First paint: static shell from the CDN (instant).
- Personal holes stream in; skeletons reserve space to prevent layout shift.
- Catalogue updates propagate by `revalidateTag("products")` (stale-while-revalidate) or `updateTag` after an admin edit.

### Pitfalls
1. Reading `cookies()` in the layout above everything → whole page becomes request-time.
2. Unbounded cache cardinality (keying by user id) → memory pressure and low hit rate.
3. Leaking personal data through shared context (e.g. stuffing user info into a cached component's props or `children` capture).
4. Forgetting that the in-memory runtime cache may not persist in serverless; the shell still comes from build/prerender.
5. Client-side personalisation (fetch after load) is simpler but causes late pop-in and extra requests; fine for non-critical widgets.

### Alternatives
- Edge personalisation with `proxy.ts` rewriting to variants (A/B tests) keyed by a cookie and cached per variant.
- Full client-side personalisation via an API after hydration.

## Follow-ups
- **How would you personalise prices per country?** — Treat country (from `headers()`) as a coarse argument to a cached function.
- **How do you verify nothing leaks?** — Inspect cache keys/args, test with two sessions, and review that shared caches never receive user ids unintentionally.

## Common Mistakes
- Using user id as a cache key for rarely repeated data.
- Skipping auth in data functions because the page checks it.

## Tips
- Draw the three layers and say which APIs mark each.
