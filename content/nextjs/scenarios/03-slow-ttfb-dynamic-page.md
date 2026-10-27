---
title: "The dashboard has a 2.8 s TTFB: diagnose and restructure it"
level: advanced
type: scenario
tags: [ttfb, streaming, suspense, waterfall, caching, cache-components, performance]
related: [nextjs/streaming-suspense, nextjs/app-shell-partial-prerendering, nextjs/avoid-data-waterfalls, nextjs/dashboard-partial-personalization]
---

## Question
A per-user dashboard in the App Router takes 2.8 s to first byte. The layout calls `await getUser()`, the page awaits five data functions sequentially (200–600 ms each), and everything is rendered per request. Walk through the diagnosis and redesign for the best perceived and actual performance.

## Clues
- Everything awaited above the first `Suspense` boundary delays the first byte.
- Independent requests can start together.
- Shared data can be cached; personal data should stream.

## Interview Answer
I'd start by measuring, with server timing or OpenTelemetry spans, how much of the 2.8 s is the serial data waterfall versus a slow single query, auth, or cold starts. Then redesign in layers. Parallelise independent fetches (start promises early or `Promise.all`), then stop blocking the shell: keep the layout light (user lookup via a `cache()`-memoised DAL call, not awaited at the top of the layout, or pushed into a Suspense-wrapped component), wrap each independent widget in its own `<Suspense>` with a skeleton so the shell and fast parts stream immediately, and move data shared across users into `"use cache"` functions with `cacheLife`/`cacheTag` so those parts join the static shell. Slow personal queries remain request-time but stream. Finally I fix the slowest query itself (indexes, N+1, fewer columns), co-locate the server with the database, and verify TTFB and LCP before and after.

## Explanation
### 1. Measure

```txt
span: GET /dashboard                  2800 ms
  ├─ auth/session                      120
  ├─ getUser (layout)                  250
  ├─ getStats                          600  ┐
  ├─ getOrders                         500  │ sequential:  → 1900 ms
  ├─ getNotifications                  300  │
  ├─ getTeam                           200  │
  └─ getBilling                        300  ┘
  └─ render + serialize                530
```

Add `Server-Timing` headers or OTel spans (`instrumentation.ts`) to see this; guessing is slow.

### 2. Remove the waterfall

```tsx
// Before
const stats = await getStats();
const orders = await getOrders();
const notes = await getNotifications();

// After: independent work runs concurrently
const [stats, orders, notes] = await Promise.all([getStats(), getOrders(), getNotifications()]);
```

Better still, don't await them in the page at all (next step).

### 3. Stream with boundaries

```tsx
export default function Dashboard() {
  return (
    <>
      <Header />                                          {/* static / fast */}
      <Suspense fallback={<StatsSkeleton />}><Stats /></Suspense>
      <Suspense fallback={<OrdersSkeleton />}><Orders /></Suspense>
      <Suspense fallback={<NotesSkeleton />}><Notifications /></Suspense>
    </>
  );
}

async function Stats() {                                   // each component fetches its own data
  const stats = await getStats();                         // memoised if reused elsewhere
  return <StatsPanel stats={stats} />;
}
```

Each widget renders as soon as its data arrives. The first byte now depends only on what is outside the boundaries.

### 4. Lighten the layout

```tsx
// layout.tsx: don't block the whole segment on the user lookup
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Suspense fallback={<NavSkeleton />}><UserMenu /></Suspense>   {/* awaits getUser() inside */}
      {children}
    </div>
  );
}
```

Authorisation still happens in the DAL for each data function, not in the layout.

### 5. Cache what's shared
`getTeam`, `getBilling` plan details, and aggregate stats that aren't per user can be `"use cache"` with `cacheLife("minutes")` and tags, so repeated requests skip the work and become part of the shell when long-lived enough.

```tsx
async function getPlanCatalog() {
  "use cache";
  cacheLife("hours");
  cacheTag("plans");
  return db.plan.findMany();
}
```

Per-user results stay uncached (or cached by coarse, low-cardinality arguments).

### 6. Fix the slow queries
- Add indexes, avoid N+1, select only needed columns, paginate, precompute aggregates.
- Use a connection pool; avoid opening a new connection per request in serverless.
- Region: deploy compute near the database.
- Cold starts: keep functions warm or use a Node server for steady traffic.

### 7. Verify

| Metric | Before | After |
|---|---|---|
| TTFB | 2.8 s | ~150 ms (shell) |
| Time to stats visible | 2.8 s | ~700 ms |
| Time to all widgets | 2.8 s | ~700 ms (parallel) |

Confirm with production traces and RUM; add a performance budget or alert.

### Trade-offs
- More skeletons: design them to match final layout to avoid CLS.
- Status codes are fixed once streaming starts; do auth redirects before the first flush (in the DAL call from the page outside Suspense, or in proxy for obvious cases).
- SEO: streamed content is still in the HTML, but critical SEO content should be in the shell.

## Follow-ups
- **Does `Promise.all` or Suspense help more?** — `Promise.all` cuts total duration; Suspense improves perceived performance by not waiting for the slowest. Use both.
- **How would you detect regressions?** — Server timing in logs, synthetic checks, and RUM TTFB percentiles.

## Common Mistakes
- Awaiting data in the layout above all boundaries.
- Adding Suspense without parallelising (each boundary can still be slow).
- Caching personal data in shared caches.

## Tips
- Present it as: measure, parallelise, stream, cache shared, optimise queries, verify.
