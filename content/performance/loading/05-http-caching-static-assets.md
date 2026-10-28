---
title: "Design a caching strategy: Cache-Control, hashed assets, ETag, stale-while-revalidate and CDN"
level: hard
type: design
tags: [http-caching, cache-control, immutable, etag, stale-while-revalidate, cdn, service-worker]
related: [nextjs/caching-layers-overview, browser-security/http-caching, performance/bundle-analysis]
---

## Question
Design HTTP caching for a web app with hashed JS/CSS bundles, images, an HTML shell, and a JSON API. Which `Cache-Control` headers do you set for each, how do validators (`ETag`, `Last-Modified`) work, what does `stale-while-revalidate` do, and how do you roll out new deployments safely?

## Clues
- Content-hashed filenames can be cached forever.
- HTML should be revalidated or short-lived so new deployments are picked up.
- Distinguish browser (private) caches from shared CDN caches.

## Interview Answer
I split assets by mutability. Fingerprinted static assets (`app.3f9c2.js`, hashed images and fonts) get `Cache-Control: public, max-age=31536000, immutable`, so browsers and CDNs keep them for a year without revalidating; deployments change the filenames, so there's no staleness. The HTML document that references those assets gets `no-cache` (store but revalidate every time with `ETag`) or a short `max-age` plus `stale-while-revalidate` at the CDN, so users pick up new releases quickly while still being fast. API responses depend on freshness and privacy: public cacheable data uses `s-maxage` for the CDN with `stale-while-revalidate`, personalised responses use `private, no-store` or `private, max-age=0`. Validators (`ETag`, `Last-Modified`) enable conditional requests (`If-None-Match`) returning `304 Not Modified` with no body. I keep old assets available during rollouts to avoid 404s for tabs on the previous version, and purge or version CDN caches on deploy where needed.

## Explanation
### Directives

| Directive | Meaning |
|---|---|
| `max-age=N` | fresh for N seconds in any cache |
| `s-maxage=N` | like max-age but for shared caches (CDN); overrides max-age there |
| `public` / `private` | shared caches allowed / browser only |
| `no-cache` | may store, but must revalidate before reuse |
| `no-store` | do not store at all (sensitive data) |
| `must-revalidate` | once stale, must revalidate (no serving stale on error) |
| `immutable` | never revalidate while fresh (even on reload) |
| `stale-while-revalidate=N` | serve stale for N seconds while revalidating in the background |
| `stale-if-error=N` | serve stale if the origin errors |

### Recommended policy

| Resource | Header |
|---|---|
| Hashed JS/CSS/fonts/images | `public, max-age=31536000, immutable` |
| Unhashed static (favicon, robots) | `public, max-age=3600` (or revalidate) |
| HTML document (SSG/ISR) | `public, max-age=0, s-maxage=60, stale-while-revalidate=600` (CDN-cached briefly) or `no-cache` |
| HTML personalised | `private, no-store` (or `private, no-cache`) |
| API: public, mostly static | `public, s-maxage=300, stale-while-revalidate=3600` |
| API: user-specific | `private, no-cache` + `ETag` |
| Auth/session endpoints | `no-store` |

Next.js sets many of these automatically (immutable for `_next/static`, `s-maxage … stale-while-revalidate` for ISR, `private, no-cache, no-store` for dynamic pages).

### Validation (conditional requests)

```http
GET /api/products HTTP/1.1
If-None-Match: "v42"

HTTP/1.1 304 Not Modified          ← no body, just headers; saves bandwidth, still costs a round trip
```

`ETag` (opaque version) is stronger than `Last-Modified`; weak ETags (`W/"…"`) allow semantic equivalence. Servers compute ETags from content hashes or versions.

### Stale-while-revalidate

```txt
t=0..60       fresh: served from cache instantly
t=60..660     stale: served instantly + background refresh triggered
t>660         expired: request waits for the origin
```

Great for HTML and public APIs: users rarely wait on the origin.

### Browser vs CDN behaviour
- `Vary: Accept-Encoding` / `Accept` / `Cookie` determines cache keys; avoid `Vary: Cookie` on cacheable content.
- Query strings are part of cache keys by default; strip tracking params at the CDN.
- Service workers add another cache layer (Cache Storage): version it and clean up old entries.
- Reload behaviour: normal navigation uses the cache; reload revalidates; hard reload bypasses (except `immutable`).

### Deployments
1. Build with content hashes; upload new assets before the HTML that references them.
2. Keep previous assets for some time (tabs running old code will lazy-load old chunks; deleting them yields chunk-load errors).
3. Handle chunk-load failures by prompting a reload.
4. Purge CDN HTML/API caches on deploy or rely on short `s-maxage`.
5. Use `deploymentId`-style skew protection if available.

### Pitfalls
- Caching HTML for a year (users stuck on old bundles).
- `no-cache` mistaken for "don't cache" (it means revalidate; `no-store` means don't store).
- Hashing only in query strings (`app.js?v=3`): some proxies ignore the query.
- Setting `max-age` on personalised responses without `private`.
- CDN ignoring origin headers by default rules.

### Verification
Check headers in DevTools (Network, "Size" column showing `disk cache`/`304`), `curl -I`, CDN analytics (hit ratio), and Lighthouse "Serve static assets with an efficient cache policy".

## Follow-ups
- **Why is `immutable` useful?** — Browsers otherwise revalidate on reload even for fresh resources; immutable avoids that.
- **`Cache-Control` vs `Expires`?** — `Cache-Control` takes precedence and is more expressive.

## Common Mistakes
- Not fingerprinting assets.
- Long-lived HTML caching.
- Confusing `no-cache` and `no-store`.

## Tips
- Tabulate by resource type; it's the clearest way to answer.
