---
title: "Time-based vs on-demand revalidation: when do you use each?"
level: medium
type: concept
tags: [revalidation, isr, stale-while-revalidate, webhooks, cacheLife]
related: [nextjs/cache-tag-and-invalidation, nextjs/use-cache-and-cache-life, nextjs/revalidate-after-mutation, nextjs/fetch-cache-previous-model]
---

## Question
Compare time-based revalidation (ISR-style) with on-demand revalidation. How does stale-while-revalidate behave, what are the trade-offs, and how do you combine them?

## Interview Answer
Time-based revalidation sets a lifetime: after N seconds, the next request still gets the cached version while Next.js regenerates it in the background, so users never wait for a slow render, but data can be up to N seconds stale plus one extra request. On-demand revalidation invalidates when something actually changes, through `revalidateTag`, `updateTag` or `revalidatePath` called from a Server Action or webhook, which gives fresh data right after a change but needs a trigger and wiring. I usually combine them: tag data and revalidate on events for freshness, and keep a `cacheLife` time as a safety net for missed events. Pure time-based suits data without a change signal, such as third-party feeds; on-demand suits CMS content and mutations you control.

## Explanation
### Time-based

```tsx
// Cache Components
async function getRates() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  return fetchRates();
}

// Previous model
await fetch(url, { next: { revalidate: 300 } });
export const revalidate = 300;     // segment config
```

Stale-while-revalidate timeline:

```txt
t=0     first request: miss, render and store
t<300   hits, instant
t=301   request: serves cached, triggers background refresh
t=302   next request: gets fresh
t>expire (no traffic): next request blocks for fresh content
```

### On-demand

```ts
// after a mutation
updateTag("posts");                    // immediate, Server Action only
revalidateTag("posts", "max");         // SWR, Server Action or Route Handler
revalidatePath("/blog");               // by path
```

### Comparison

| | Time-based | On-demand |
|---|---|---|
| Trigger | clock | event (mutation, webhook) |
| Freshness | up to the interval | immediate or next request |
| Work wasted | regenerates even if unchanged | regenerates only on change |
| Complexity | trivial | needs tags + trigger + auth |
| Failure mode | stale for a window | stale forever if the event is missed |
| Fit | feeds, prices, metrics | CMS, user edits, admin tools |

### Combining

```tsx
async function getArticle(slug: string) {
  "use cache";
  cacheLife("days");                    // safety net
  cacheTag(`article-${slug}`);          // precise invalidation from the CMS webhook
  return cms.get(slug);
}
```

### Practicalities
- Time-based revalidation is per entry; the lowest value in a previous-model route determines the whole route's frequency.
- With multiple server instances, invalidation must be coordinated through a shared cache handler; on Vercel it's handled by the platform.
- Revalidating regenerates both HTML and RSC payload; users mid-session may see old data until their client cache `stale` time passes or they navigate.
- In dev, pages are always rendered on demand, so test with a production build.
- Secure webhooks with secrets; rate-limit.

### Choosing quickly
1. Do I control the change? → on-demand + safety-net time.
2. No change signal? → time-based, choose the interval from the business tolerance for staleness.
3. Must the editor see the result instantly? → `updateTag`.

## Follow-ups
- **What is "stale-while-revalidate"?** — Serve the stale value immediately and refresh in the background so latency stays low.
- **What happens on a cold cache?** — The first request pays the full render cost.

## Common Mistakes
- Setting `revalidate: 1` to fake real-time (generates constant load).
- Relying only on webhooks with no expiry.
- Expecting revalidation to refresh already-open pages.

## Tips
- Say "events for freshness, time for safety".
