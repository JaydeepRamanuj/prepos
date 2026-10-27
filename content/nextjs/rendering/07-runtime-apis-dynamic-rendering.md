---
title: "Runtime APIs (cookies, headers, searchParams, connection): how do they affect rendering?"
level: hard
type: concept
tags: [cookies, headers, searchParams, connection, dynamic-rendering, runtime-apis]
related: [nextjs/app-shell-partial-prerendering, nextjs/use-cache-and-cache-life, nextjs/streaming-suspense, nextjs/dashboard-partial-personalization]
---

## Question
Which APIs make a component depend on the incoming request in Next.js 16? Why are `cookies()`, `headers()`, `params` and `searchParams` async, what happens if you use them without Suspense, and how do you use request data inside cached code?

## Clues
- Request-time data isn't known during prerender.
- A component that reads it must stream.
- A cached function cannot read runtime APIs directly.

## Interview Answer
Request-time APIs are `cookies()`, `headers()`, `draftMode()`, `connection()`, the `searchParams` prop, and `params` when a dynamic segment isn't pre-generated. They're async in current Next.js so rendering can pause until the request data is available, and so that the framework can tell exactly where dynamic access happens. With Cache Components, a component that awaits one of them is request-time work: it must sit inside a `<Suspense>` boundary (or the route reports a blocking-route problem), and everything outside the boundary can still be prerendered. To combine them with caching I read the value outside and pass it as an argument to a `"use cache"` function, making it part of the cache key; reading `cookies()` inside `use cache` is an error, with `"use cache: private"` as the escape hatch for special cases. `await connection()` is how I explicitly say "this must be rendered per request", for example before using random values or timestamps.

## Explanation
### The list

| API | Source | Notes |
|---|---|---|
| `cookies()` | `next/headers` | read; writing only in Server Actions / Route Handlers |
| `headers()` | `next/headers` | read-only |
| `draftMode()` | `next/headers` | preview content |
| `connection()` | `next/server` | opt a component into request time |
| `searchParams` | page prop | Promise; never known at build time |
| `params` | page/layout prop | Promise; known only for `generateStaticParams` values |

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;       // request time
  // ...
}
```

### Why async
In older versions these were synchronous and silently turned the entire route dynamic. Making them promises (Next.js 15) lets the framework suspend only the component that reads them, which is what makes partial prerendering possible.

### Isolating dynamic access

```tsx
export default function Page() {
  return (
    <>
      <StaticHero />
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />          {/* awaits cookies() */}
      </Suspense>
    </>
  );
}

async function Greeting() {
  const name = (await cookies()).get("name")?.value ?? "friend";
  return <p>Hello, {name}</p>;
}
```

### Runtime values + caching

```tsx
async function Recs() {
  const segment = (await cookies()).get("segment")?.value ?? "default";
  return <CachedRecs segment={segment} />;      // extracted outside the cache
}

async function CachedRecs({ segment }: { segment: string }) {
  "use cache";
  cacheLife("minutes");
  return <List items={await getRecs(segment)} />;   // segment is part of the cache key
}
```

Rules of thumb: cache by coarse values (segment, locale, plan) rather than unique ids unless reuse is realistic.

### `use cache: private`
Allows cookies/headers inside the cached scope, with the result cached only in the browser's memory (never shared across users on the server). Use for compliance or when refactoring isn't possible. It's rare.

### Per-request randomness

```tsx
async function RequestId() {
  await connection();                  // signals: do not prerender this
  return <p>{crypto.randomUUID()}</p>;
}
```

Wrap in Suspense. Alternatively, cache it to share one value.

### `searchParams` UX
Reading `searchParams` in a page makes that page request-time. If filtering is client-driven (tabs, sorting), `useSearchParams()` in a Client Component wrapped in Suspense keeps the page shell static. Changing only search params on navigation doesn't remount layouts.

### Route Handlers and `proxy.ts`
`GET` Route Handlers follow the same prerendering model with Cache Components: reading the request opts into request time. Proxy runs before routing and can rewrite or set headers/cookies; it's not a data layer.

### Legacy flags
Segment configs like `export const dynamic = 'force-dynamic'` are replaced by this component-level model when Cache Components is enabled.

## Follow-ups
- **What if I forget Suspense?** — The dev overlay reports a blocking route and the build validation fails or warns, depending on the setting.
- **Can I read cookies in a layout?** — Yes, but it makes all content below request-time unless isolated; prefer leaves.

## Common Mistakes
- Awaiting `searchParams` at the page level and wondering why nothing is static.
- Reading `cookies()` inside `use cache`.
- Using unique ids as cache keys for data nobody shares.

## Tips
- Mention that async APIs are what enable component-level dynamic holes.
