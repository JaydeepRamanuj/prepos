---
title: "Node.js vs Edge runtime in Next.js: what are the differences and when does it matter?"
level: hard
type: concept
tags: [edge-runtime, nodejs-runtime, proxy, route-handlers, latency, compatibility]
related: [nextjs/proxy-ts-replaces-middleware, nextjs/vercel-vs-self-hosting, backend/node-event-loop]
---

## Question
Compare the Node.js and Edge runtimes in Next.js. What can't run on Edge, how do you select a runtime per route, what happened to Edge for proxy in Next.js 16, and how would you decide for a latency-sensitive endpoint?

## Clues
- The Edge runtime is a restricted, Web-API-based environment.
- Database drivers and many npm packages need Node APIs.
- Proxy changed its default runtime in Next.js 16.

## Interview Answer
The Node.js runtime has full Node APIs and npm compatibility, supports all Next.js features including ISR, large bundles and native modules, and is the default for pages, Server Components, actions and route handlers. The Edge runtime is a lightweight V8-isolate environment using Web-standard APIs (fetch, Request/Response, Web Crypto), with fast cold starts and global distribution, but no `fs`, no native modules, limited Node APIs, small code-size limits and restricted dependencies. You can select it per route with `export const runtime = 'edge'` in a route segment or handler, but in Next.js 16 route handlers and pages default to Node.js, and `proxy.ts` runs on Node.js with the `runtime` option unavailable, while the old `middleware` convention was Edge. I use Edge only when the code is small, Web-API-only, and benefits from running near the user (simple redirects, geolocation-based rewrites, lightweight auth token checks), and I keep database-heavy work on Node close to the data, since a distant database dominates latency.

## Explanation
### Comparison

| | Node.js runtime | Edge runtime |
|---|---|---|
| APIs | full Node (`fs`, `net`, `crypto`, streams) | Web APIs only; subset of Node |
| npm packages | nearly all | only compatible ones (no native addons, limited `Buffer`/`process`) |
| Cold start | slower (seconds worst case on serverless) | very fast |
| Location | region(s) of your choosing | many locations, close to the user |
| Code size | large allowed | small limits (1–4 MB range, platform dependent) |
| Features | all (ISR, image optimisation, etc.) | no ISR, limited caching features |
| DB access | any driver, connection pooling | HTTP-based or edge-compatible drivers only |
| Streaming | yes | yes |

### Selecting a runtime

```ts
// app/api/geo/route.ts
export const runtime = "edge";           // opts this handler into Edge

export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country") ?? "unknown";
  return Response.json({ country });
}
```

The `runtime` segment option isn't available with Cache Components in some contexts, and not in `proxy.ts`. Check the segment config docs for the version in use.

### Next.js 16 and proxy
- `proxy.ts` replaces `middleware.ts`, runs on Node.js, and does not support setting `runtime`.
- If you need Edge for it, keep using the deprecated `middleware.ts` for now.
- Because Node is available, you can use Node-only packages in proxy, but still keep it light.

### Why Edge isn't automatically faster
Latency = network to the runtime + compute + network to the data. If your database lives in one region, running on a global Edge location adds round trips (user → edge → database region → edge → user). Co-locating compute with the database on Node.js usually wins for data-heavy requests; Edge wins when no remote data is needed or the data is replicated globally (edge config, KV, read replicas).

### Compatibility checks
- Use `import "server-only"` and avoid Node-only modules in Edge files; build errors will tell you which APIs are unsupported.
- ORMs: use HTTP/driver adapters (Neon serverless driver, PlanetScale, Turso/libSQL, Prisma with Accelerate/driver adapters) for Edge.
- Crypto: use Web Crypto (`crypto.subtle`) rather than Node's `crypto` module; libraries such as `jose` work on both.
- Memory/CPU limits are strict; no long-running work.

### Deciding

| Scenario | Choice |
|---|---|
| Static redirects / rewrites, header injection | proxy (Node in 16) or CDN-level config |
| Geo/AB personalisation with no DB | Edge route handler or proxy |
| Server Components with DB queries | Node, near the DB |
| Image generation (`ImageResponse`) | either; Node is common |
| Webhooks needing Node SDKs (Stripe) | Node |
| Auth token verification only | either; verification libs must be Edge-compatible |

## Follow-ups
- **Can Server Components run on Edge?** — They could with `runtime = 'edge'` in older versions, but it's discouraged and limited; default Node.
- **Is Edge cheaper?** — Depends on the platform's pricing; measure.

## Common Mistakes
- Putting database-heavy handlers on Edge because "edge = fast".
- Using Node-only libraries in an Edge route.
- Assuming `middleware` and `proxy` have the same runtime.

## Tips
- Talk about total latency (user → compute → data), not just cold starts.
