---
title: "Caching with Redis: cache-aside, TTLs, invalidation and stampede protection"
level: hard
type: design
tags: [redis, caching, cache-aside, ttl, invalidation, cache-stampede, rate-limiting, sessions]
related: [backend/rate-limiting, backend/transactions-acid, architecture/api-contracts-caching-strategy]
---

## Question
How would you add Redis caching in front of a slow database query? Explain the cache-aside pattern, TTL and invalidation choices, cache stampedes, stale data risks, and other things Redis is used for.

## Clues
- Cache the result of expensive, frequently-read, tolerably-stale data.
- "There are only two hard things": invalidation and naming.
- Many simultaneous misses can overwhelm the database.

## Interview Answer
Redis is an in-memory data store with sub-millisecond reads that works well as a cache in front of a database. I use **cache-aside** (lazy loading): the app checks Redis by key; on a hit it returns the value; on a miss it queries the database, stores the result with a TTL, and returns it. Writes update the database and then invalidate (delete) the cache key rather than trying to update it in place, which avoids most races. TTLs bound staleness as a safety net; I add jitter so many keys don't expire together. A **cache stampede** happens when a hot key expires and thousands of requests hit the database simultaneously; mitigations are request coalescing (per-key lock or single-flight), stale-while-revalidate (serve slightly stale data while one request refreshes), probabilistic early refresh, and TTL jitter. I key by everything that changes the result (resource, parameters, tenant, locale) and never cache personalised data under a shared key. Beyond caching, Redis is used for sessions, rate limiting, queues, locks, pub/sub, leaderboards (sorted sets) and idempotency keys. I treat it as a disposable derived store; the database stays the source of truth.

## Explanation
### Cache-aside

```ts
async function getProduct(id: string) {
  const key = `product:v1:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const product = await db.product.findUnique({ where: { id } });
  if (product) await redis.set(key, JSON.stringify(product), "EX", 300 + Math.floor(Math.random() * 60));   // TTL + jitter
  return product;
}

async function updateProduct(id: string, data: Partial<Product>) {
  const updated = await db.product.update({ where: { id }, data });
  await redis.del(`product:v1:${id}`);               // invalidate after the write commits
  return updated;
}
```
Cache negative results (not found) briefly to prevent repeated misses hitting the database.

### Patterns compared

| Pattern | Write path | Pros | Cons |
|---|---|---|---|
| Cache-aside | app writes DB, deletes key | simple, resilient to cache failure | first request after invalidation is slow; small race windows |
| Read-through | cache layer loads on miss | cleaner app code | needs a cache provider that supports it |
| Write-through | write to cache and DB together | cache always warm | write latency, caches unread data |
| Write-behind | write cache, async flush to DB | very fast writes | risk of data loss |
| Refresh-ahead | refresh popular keys before expiry | no cold hits | complexity |

### Invalidation strategies
- **TTL only**: simplest; accept staleness up to the TTL.
- **Explicit delete on write**: precise, but you must find all keys affected (lists, aggregates). Use key versioning (`products:list:v{n}`) or tags (a set of keys per entity) to invalidate groups.
- **Event-driven**: publish change events (DB triggers, CDC, queue) that invalidate caches.
- **Versioned keys**: bump a version number on change instead of deleting many keys; old keys expire naturally.

Race: reader misses, reads old row, writer updates and deletes key, reader then sets stale data. Mitigate with short TTLs, delayed double-delete, or version checks. For critical data, don't cache.

### Stampede protection
```ts
async function getWithLock(key: string, load: () => Promise<string>, ttl = 60) {
  const hit = await redis.get(key);
  if (hit) return hit;

  const lock = await redis.set(`lock:${key}`, "1", "EX", 10, "NX");        // only one request loads
  if (lock) {
    try { const v = await load(); await redis.set(key, v, "EX", ttl); return v; }
    finally { await redis.del(`lock:${key}`); }
  }
  await new Promise((r) => setTimeout(r, 50));                              // others wait briefly and retry
  return getWithLock(key, load, ttl);
}
```
Also: in-process single-flight (share one in-flight promise per key), stale-while-revalidate, and jittered TTLs.

### Practical details
- **Serialization**: JSON for simplicity; keep values small (large values block the single-threaded server).
- **Eviction policy**: set `maxmemory` and `allkeys-lru` (or `volatile-lru`) so memory pressure evicts instead of failing.
- **Key design**: namespaced and versioned (`app:product:v2:42`), include tenant/locale; never user-controlled raw strings without hashing/escaping.
- **Don't use `KEYS *` in production**; use `SCAN`.
- **Persistence**: RDB/AOF are optional; as a cache assume it can be wiped.
- **Failure mode**: if Redis is down, fall back to the DB (with rate limits and timeouts) rather than failing requests.
- **Serverless**: use HTTP-based clients (Upstash) or connection-managed drivers.
- **Security**: network isolation, TLS, auth; never cache secrets or other users' private data under shared keys.
- **Observability**: hit ratio, latency, evictions, memory; low hit ratio means the cache isn't helping.

### Other Redis uses
- Sessions and short-lived tokens (with TTL).
- Rate limiting (atomic `INCR`/Lua) and quotas.
- Distributed locks (`SET NX PX`; use Redlock cautiously and design for lock expiry).
- Queues/streams (BullMQ, Redis Streams), pub/sub for real-time fan-out.
- Leaderboards with sorted sets, counters, HyperLogLog for approximate uniques.

### Layers
Remember the other caches: browser/CDN HTTP caching, framework caches (Next.js `use cache`), in-process memoisation. Pick the layer closest to the consumer that satisfies freshness.

## Follow-ups
- **Why delete the key on write instead of updating it?** — Updating requires reproducing the exact cached shape and is prone to races; deletion lets the next read rebuild from the source of truth.
- **Redis vs in-memory cache in the Node process?** — In-process is faster but per-instance and lost on restart; Redis is shared across instances.

## Common Mistakes
- Caching without any invalidation plan.
- Identical TTLs causing synchronized expiry.
- Treating Redis as the system of record.

## Tips
- Draw the hit/miss flow, then address staleness and stampedes explicitly.
