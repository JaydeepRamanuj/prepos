---
title: "Rate limiting: algorithms, where to enforce it and client-side handling of 429"
level: hard
type: design
tags: [rate-limiting, token-bucket, sliding-window, redis, 429, retry-after, abuse-prevention]
related: [backend/rest-api-design, backend/redis-caching, architecture/api-client-error-handling]
---

## Question
Design rate limiting for a public API and a login endpoint. Compare algorithms (fixed window, sliding window, token bucket), explain how you'd implement it with Redis, what to key on, which headers to return, and how the frontend should react to 429.

## Clues
- Counters must be shared across instances and updated atomically.
- Decide what identity you limit by before choosing the algorithm.
- A good 429 response tells the client when to retry.

## Interview Answer
Rate limiting protects availability and fairness (and slows brute-force attacks) by capping how many requests a client can make in a time window. Common algorithms: **fixed window** (counter per window; simple, but allows 2× bursts at window boundaries), **sliding window** (log or weighted counters; smoother and more accurate), **token bucket** (tokens refill at a steady rate up to a burst capacity; allows controlled bursts and is the usual production choice) and **leaky bucket** (constant outflow, smoothing traffic). In a multi-instance deployment the counters must be shared, so I use Redis with atomic operations (a Lua script or `INCR` + `EXPIRE`) keyed by identity: user id when authenticated, API key for integrations, otherwise IP (with care for NAT and proxies), plus stricter limits for sensitive endpoints such as login (per account and per IP). The response is `429 Too Many Requests` with `Retry-After` and informative `RateLimit-*` headers. Limits are enforced as early as possible (CDN/WAF/gateway) and again in the app for business rules. The client respects `Retry-After`, uses exponential backoff with jitter, and disables the triggering control instead of hammering the server.

## Explanation
### Algorithms

| Algorithm | How | Pros | Cons |
|---|---|---|---|
| Fixed window | counter per minute/hour | trivial, cheap | boundary bursts (up to 2× limit) |
| Sliding log | store timestamps, count within last N seconds | exact | memory heavy |
| Sliding window counter | weighted blend of current and previous window | smooth, cheap | approximate |
| Token bucket | bucket of capacity C refills r tokens/sec; request spends 1 | bursts allowed, steady rate | slightly more state |
| Leaky bucket | queue drained at fixed rate | very smooth output | adds latency, drops on overflow |

### Fixed window in Redis
```ts
async function allow(key: string, limit: number, windowSec: number) {
  const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const count = await redis.incr(k);
  if (count === 1) await redis.expire(k, windowSec);       // race: wrap in MULTI or Lua for atomicity
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
```
For correctness under concurrency use a Lua script or libraries like Upstash `@upstash/ratelimit` (fixed, sliding and token-bucket strategies, works on serverless/edge), or `rate-limiter-flexible`.

### Token bucket (Lua sketch)
Store `tokens` and `lastRefill`; on each request compute `tokens = min(capacity, tokens + elapsed * rate)`, deny if `< 1`, else decrement. Doing this inside one Lua script keeps it atomic.

### What to key on
- Authenticated user id (best), API key/tenant id.
- IP address as fallback: read the real client IP from the trusted proxy header (`X-Forwarded-For` only from your own proxy; otherwise it's spoofable), and remember shared IPs (offices, mobile carriers).
- Compound keys for login: `ip + username` and `username` alone, so an attacker cannot rotate IPs to brute-force one account (while avoiding lock-out denial of service: use progressive delays/CAPTCHA instead of hard lockouts).
- Per-endpoint and per-cost limits (search, exports, AI calls are heavier than reads).

### Response contract
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
Content-Type: application/problem+json
```
(`X-RateLimit-*` headers are the widespread legacy names; the `RateLimit-*` fields are being standardised.)

### Where to enforce
CDN/WAF (Cloudflare, Vercel Firewall) for volumetric abuse → API gateway for per-key quotas → application for business-specific rules (e.g. 5 password attempts per 15 minutes). In Next.js, `proxy.ts` can apply cheap limits before rendering; Route Handlers and Server Actions can call the limiter directly. Avoid in-memory counters on serverless since instances don't share memory.

### Frontend behaviour
- Treat 429 as expected: read `Retry-After`, show "Too many attempts, try again in 30s", and disable the button until then.
- Backoff with jitter for automatic retries; don't retry non-idempotent requests blindly.
- Debounce or throttle user-triggered calls (search-as-you-type), batch requests, and cache to stay under quotas.
- Handle `Retry-After` as seconds or an HTTP date.

### Abuse beyond rate limits
Bot detection and CAPTCHAs for signup/login, per-account quotas, request-size limits, timeouts, concurrency limits, idempotency keys, and monitoring/alerting on spikes.

## Follow-ups
- **Why not just limit by IP?** — NAT puts many users behind one IP, and attackers can rotate IPs; use identity-based limits when possible.
- **Fail open or closed when Redis is down?** — Usually open for general APIs (availability), closed for security-critical endpoints like login.

## Common Mistakes
- In-memory limits on multi-instance or serverless deployments.
- Trusting `X-Forwarded-For` from the client.
- Hard account lockouts that become a denial-of-service vector.

## Tips
- Mention token bucket with burst capacity, shared Redis state and the `Retry-After` handshake with the client.
