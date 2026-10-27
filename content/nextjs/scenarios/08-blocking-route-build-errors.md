---
title: "Cache Components build fails with 'blocking route' errors: how do you fix them?"
level: hard
type: debugging
tags: [cache-components, blocking-route, suspense, use-cache, params, connection, migration]
related: [nextjs/app-shell-partial-prerendering, nextjs/runtime-apis-dynamic-rendering, nextjs/use-cache-and-cache-life, nextjs/streaming-suspense]
---

## Question
You turn on `cacheComponents: true` and the dev overlay and build report blocking-route problems for several pages. The following components are flagged. Classify each cause and apply the right fix.

```tsx
// layout.tsx
export default async function Layout({ children, params }: LayoutProps<"/shop/[slug]">) {
  const { slug } = await params;
  const cat = await getCategory(slug);
  return <div><h1>{cat.name}</h1>{children}</div>;
}

// Footer.tsx
export async function Footer() {
  const year = new Date().getFullYear();
  const visits = await db.counter.get("visits");
  return <footer>© {year} · {visits} visits</footer>;
}

// Greeting.tsx
export async function Greeting() {
  const name = (await cookies()).get("name")?.value;
  return <p>Hello {name}</p>;
}

// Page.tsx
export default function Page() {
  const orderId = crypto.randomUUID();
  return <Receipt id={orderId} />;
}
```

## Clues
- Each flagged item either needs request data, or reads uncached data, or produces non-deterministic values during prerender.
- You can cache it, stream it behind Suspense, or defer it to request time with `connection()`.
- Moving the `await` deeper makes the static shell larger.

## Interview Answer
With Cache Components, prerendering must be able to complete or reach a Suspense boundary. The layout awaits `params` and a database call at the top, so the whole segment depends on request data (the slug isn't known at build time unless `generateStaticParams` provides it): fix by providing static params for popular slugs, passing the `params` promise down, and awaiting it in a component wrapped in Suspense, caching the category lookup with `"use cache"`. The footer's year is stable enough to render, but `db.counter.get` is uncached I/O: either cache it with a `cacheLife` or stream it behind Suspense. `Greeting` reads `cookies()`, a runtime API, so it must sit inside Suspense (or read the cookie outside and pass it to a cached function). The page calls `crypto.randomUUID()` during prerender, which is non-deterministic: either generate it per request with `await connection()` inside a Suspense boundary, or generate it on the client or inside `"use cache"` if one shared value is acceptable. The principle is to push dynamic access down and wrap it with fallbacks.

## Explanation
### Classification

| Component | Cause | Options |
|---|---|---|
| Layout | awaiting `params` (runtime unless pre-generated) + uncached DB read at the top | `generateStaticParams`, push `await params` into a Suspense-wrapped child, cache `getCategory` |
| Footer | uncached I/O (`db.counter.get`) | `"use cache"` + `cacheLife("minutes")`, or `<Suspense>` |
| Greeting | `cookies()` is a runtime API | wrap in `<Suspense>`; or pass the cookie value to a cached component |
| Page | `crypto.randomUUID()` non-deterministic during prerender | `await connection()` + Suspense, or cache, or move to the client |

### Fixes

```tsx
// layout.tsx: static shell survives; category header streams or is cached
export async function generateStaticParams() {
  return (await getTopCategories()).map((c) => ({ slug: c.slug }));   // at least one required
}

export default function Layout({ children, params }: LayoutProps<"/shop/[slug]">) {
  return (
    <div>
      <Suspense fallback={<h1>Loading…</h1>}>
        <CategoryHeader params={params} />                // await happens inside the boundary
      </Suspense>
      {children}
    </div>
  );
}

async function CategoryHeader({ params }: Pick<LayoutProps<"/shop/[slug]">, "params">) {
  const { slug } = await params;
  const cat = await getCategory(slug);
  return <h1>{cat.name}</h1>;
}

async function getCategory(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`category-${slug}`);
  return db.category.findUnique({ where: { slug } });
}
```

```tsx
// Footer: cache the whole component so both the year and the counter are computed once per lifetime
export async function Footer() {
  "use cache";
  cacheLife("minutes");
  const visits = await db.counter.get("visits");
  return <footer>© {new Date().getFullYear()} · {visits} visits</footer>;
}
```

Reading the current time outside a cache scope is flagged (it would freeze at build time); inside a `"use cache"` scope it is computed when the entry is filled and refreshed on revalidation.

```tsx
// Greeting: runtime data behind Suspense
<Suspense fallback={<p>Hello</p>}><Greeting /></Suspense>
```

```tsx
// Page: unique per request
async function Receipt() {
  await connection();                       // opt into request time
  return <ReceiptView id={crypto.randomUUID()} />;
}
export default function Page() {
  return <Suspense fallback={<ReceiptSkeleton />}><Receipt /></Suspense>;
}
```

Better: generate the order id at the moment of purchase on the server (in the action) and store it; rendering shouldn't invent identifiers.

### General algorithm for any flagged access
1. Can this be deterministic and shared? → `"use cache"` with `cacheLife`/`cacheTag`.
2. Does it need request data? → move it into its own component, wrap in `<Suspense>` with a same-size fallback.
3. Is it random/time-based per request? → `await connection()` then Suspense; or cache one shared value.
4. Does it read `params`/`searchParams`? → provide `generateStaticParams`, or pass the promise down and await inside Suspense.
5. Only truly static? → leave it alone.

### Benefits of the pattern
The static shell grows, TTFB improves, and the dev overlay's insights document intent: each dynamic hole is explicit.

### Gotchas
- Route segment configs like `dynamic = "force-dynamic"` and `revalidate` conflict with Cache Components; remove them.
- `generateStaticParams` returning an empty array errors; return at least one param (a real one) for validation.
- A fallback that doesn't match final layout causes layout shift.
- Wrapping everything in one Suspense at the root defeats partial prerendering, although it satisfies the validator.

## Follow-ups
- **Can I disable the validation temporarily?** — Prefer fixing; the docs describe opting a route out of prerendering when needed.
- **Why is `performance.now()` allowed?** — It's meant for telemetry, so Next.js doesn't treat it as a value to guard.

## Common Mistakes
- Wrapping the whole page in Suspense just to silence errors.
- Using `Math.random()` in render.
- Removing `await params` and assuming it'll work.

## Tips
- Recite the five-step algorithm; it works for every blocking-route message.
