---
title: "HTTP caching: Cache-Control, ETag, and caching static assets vs API responses"
level: medium
type: concept
tags: [http-caching, cache-control, etag, immutable, stale-while-revalidate, cdn]
related: [browser-security/cors-preflight, browser-security/http-versions, performance/http-caching-static-assets]
---

## Question
How does HTTP caching work in the browser? Explain `Cache-Control` directives, validation with `ETag`/`Last-Modified`, and what headers you would set for hashed JS bundles, HTML pages and API responses.

## Interview Answer
HTTP caching lets the browser (and shared caches like CDNs) reuse responses. `Cache-Control` decides freshness: `max-age=N` means the response is fresh for N seconds with no network request, `no-cache` means it may be stored but must be revalidated before every use, `no-store` means never store it, `private` restricts it to the browser, and `s-maxage` sets the lifetime for shared caches. When a cached response is stale the browser revalidates with a conditional request (`If-None-Match` with the stored `ETag`, or `If-Modified-Since`), and the server answers `304 Not Modified` with no body if nothing changed. My standard setup: fingerprinted assets (`app.3f9a1c.js`) get `public, max-age=31536000, immutable` because the URL changes whenever content changes; HTML gets `no-cache` (or a short `s-maxage` with `stale-while-revalidate` on a CDN) so deployments show up immediately; personalised API responses get `private, no-store` or `private, max-age=0, must-revalidate`; public API data can use a short `max-age` plus `stale-while-revalidate`.

## Explanation
### Freshness vs validation
```txt
Request ─► fresh in cache?  ── yes ─► serve from cache (0 network)
                │ no (stale)
                ▼
        conditional request: If-None-Match: "abc"
                │
         304 Not Modified ─► reuse body, refresh lifetime
         200 + new body   ─► replace cache entry
```

### Key directives

| Directive | Meaning |
|---|---|
| `max-age=N` | fresh for N seconds in any cache |
| `s-maxage=N` | like `max-age` but only for shared caches (CDN); overrides `max-age` there |
| `no-cache` | store, but always revalidate before reuse |
| `no-store` | do not store at all (sensitive data) |
| `private` / `public` | browser-only vs shareable by CDNs |
| `immutable` | will not change during its freshness lifetime; skip revalidation on reload |
| `stale-while-revalidate=N` | serve stale instantly for N seconds while refreshing in the background |
| `stale-if-error=N` | serve stale if the origin errors |
| `must-revalidate` | once stale, must not be served without revalidation |

`no-cache` is the most misnamed header: it does **not** disable caching; `no-store` does.

### Validators
- **`ETag`**: an opaque fingerprint of the representation; the browser sends `If-None-Match`. Strong ETags compare bytes; weak ones (`W/"..."`) compare semantic equality.
- **`Last-Modified`**: timestamp; the browser sends `If-Modified-Since`. Coarser (one-second granularity).
- If neither `Cache-Control` nor `Expires` is present, browsers may apply *heuristic freshness* (often 10% of the time since `Last-Modified`), so always be explicit.

### Recommended policies

```txt
/_next/static/chunks/app.3f9a1c.js     Cache-Control: public, max-age=31536000, immutable
/index.html or SSR HTML                Cache-Control: no-cache            (or s-maxage=60, stale-while-revalidate=300 on CDN)
/api/me  (personal)                    Cache-Control: private, no-store
/api/products (public)                 Cache-Control: public, max-age=60, stale-while-revalidate=300
images with stable URL                 Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

Cache busting by **fingerprinting** is better than short TTLs: files can be cached for a year because a new deploy references new URLs. The HTML that references them must stay revalidated, otherwise users keep pointing at old bundles.

### `Vary`
`Vary: Accept-Encoding, Accept-Language` tells caches the response depends on those request headers, so they store separate variants. A wrong or missing `Vary` can serve the wrong language or gzip data to the wrong client. `Vary: Cookie` effectively disables CDN caching.

### Reload behaviour
Normal navigation uses the cache; a normal reload revalidates the main resource; hard reload (Ctrl+Shift+R) bypasses the cache. `immutable` stops reloads from revalidating fingerprinted assets.

### Browser cache layers
Memory cache (current page lifetime), disk (HTTP cache), service worker/Cache API (programmatic), and `bfcache` (whole-page snapshots for back/forward). `Cache-Control: no-store` on a page may make it ineligible for bfcache.

### In Next.js
Static assets under `/_next/static` are served immutable. Pages and route handlers have their own cache layers (see the Next.js caching chapter); response headers you set via `headers()` in config or route handlers still control the browser and CDN layer.

## Follow-ups
- **Why not just use `max-age=0`?** — It still caches but forces revalidation like `no-cache` in practice, but `no-cache` states intent more clearly.
- **How do you update a cached file under a stable URL?** — You cannot reliably; change the URL (fingerprint/version query) or purge the CDN and accept browser TTL.

## Common Mistakes
- Using `no-cache` thinking it disables storage.
- Long `max-age` on HTML or on non-fingerprinted JS.
- Caching authenticated responses in a shared cache without `private`.

## Tips
- Give the three-line policy: hashed assets immutable, HTML revalidated, personal data private.
