---
title: "Vercel vs self-hosting Next.js: what do you gain, what must you build?"
level: hard
type: design
tags: [vercel, self-hosting, docker, standalone, multi-instance, cdn, version-skew]
related: [nextjs/caching-layers-overview, nextjs/app-shell-partial-prerendering, nextjs/node-vs-edge-runtime, nextjs/environment-variables]
---

## Question
Your company wants to move a Next.js 16 app from Vercel to its own Kubernetes cluster behind a CDN. What breaks or needs extra work? Cover caching and revalidation across instances, streaming, images, environment variables, Server Actions across rolling deploys, and observability.

## Clues
- A single Node server works out of the box; multiple instances need shared state.
- Streaming and PPR need an infrastructure path that does not buffer responses.
- Build-time values are baked into the image.

## Interview Answer
A single `next start` server supports all features, including streaming, ISR, image optimisation, proxy and Cache Components. The work starts when you scale out: the default cache is in-memory or on local disk per instance, so ISR output, `use cache` entries and tag invalidations differ per pod. You need a shared cache handler (Redis or object storage) configured through `cacheHandlers` or `incrementalCacheHandlerPath`, and tag invalidation coordinated across instances through the handler's `refreshTags`. Server Actions need a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` shared by all instances, and a `deploymentId` to detect version skew during rolling updates, optionally with immutable assets kept across deploys. Streaming requires that every proxy and load balancer in front disable response buffering (for example nginx `X-Accel-Buffering: no`). Image optimisation needs Sharp and memory limits, or an external loader. `NEXT_PUBLIC_` variables are baked at build time. On Vercel, the platform provides these (shared cache, CDN, skew protection, image CDN, analytics); self-hosting trades that for control and possibly lower cost at scale, at the price of operating it yourself.

## Explanation
### What you get on a platform vs self-hosted

| Concern | Vercel (managed) | Self-hosted on Kubernetes |
|---|---|---|
| Build & deploy | git push, previews | CI pipeline, Docker image, rollout |
| Static assets | global CDN, immutable caching | CDN in front of `_next/static`, `public/` |
| ISR / `use cache` / tags | shared, coordinated | implement shared `cacheHandlers` + `refreshTags` |
| PPR static shell at CDN latency | platform integration | requires bespoke shell storage/resume or accept origin latency |
| Image optimisation | managed | Sharp on pods, cache volume or external loader |
| Server Actions across deploys | skew protection | `deploymentId` + stable encryption key |
| Edge / proxy | integrated | Node server runs proxy; CDN rules separately |
| Observability | built-in | OpenTelemetry (`instrumentation.ts`), logs, metrics |
| Scaling | automatic serverless | HPA, connection pooling, warm pods |

### Dockerising

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL      # baked at build
RUN npm run build                                  # next.config: output: "standalone"

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
CMD ["node", "server.js"]
```

`output: "standalone"` traces and copies only required files, producing a small image. Static files and `public` are copied separately and should be served by a CDN in production.

### Multi-instance checklist
1. **Encryption key**: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` identical in every instance (build-time embedded), or you get "Failed to find Server Action".
2. **Deployment id**: `deploymentId` in config; the client sends `x-deployment-id`, and mismatches trigger a hard navigation instead of broken RSC payloads.
3. **Shared cache**: custom cache handler for ISR/`use cache: remote`; the default in-memory cache is per instance.
4. **Tag invalidation**: implement `refreshTags()` so `revalidateTag` on one pod reaches the others.
5. **Immutable assets**: keep old build assets available during rollouts (CDN/bucket), or use `supportsImmutableAssets`.
6. **Streaming**: no buffering in ingress, service mesh or CDN; test with `curl -N`.
7. **Reverse proxy**: use nginx/ingress for slow-loris protection, body limits and rate limiting; set `serverActions.allowedOrigins` if the host header differs from the origin.
8. **Health and shutdown**: readiness checks, graceful termination (SIGTERM) so streaming requests finish; `after()` work needs the process alive.
9. **Images**: Sharp memory settings on glibc, volume for the image cache, or an external loader (Cloudinary, imgix).
10. **Config**: read secrets at run time from a secret manager; public values at build time.
11. **Observability**: `instrumentation.ts` with OpenTelemetry exporters; log request ids; track Web Vitals.

### CDN behaviour
Next.js sets `Cache-Control: public, max-age=31536000, immutable` for hashed assets, `s-maxage … stale-while-revalidate` for ISR pages, and `private, no-cache, no-store` for dynamic responses, so a CDN honours it automatically. Cache Components with request-time holes produce `private` documents; the CDN can't cache the whole HTML unless the platform supports serving the shell and resuming dynamic parts.

### Decision factors
Team operational maturity, traffic and cost profile, compliance/data residency, need for edge features and previews, and willingness to own cache coordination. Many teams pick managed hosting until scale or policy forces otherwise; alternatives include other platforms with adapters (Build Adapters API is in alpha) or Node on a PaaS.

## Follow-ups
- **Can I use Cache Components while self-hosting?** — Yes; it works with `next start` and Docker. Shared caching and PPR-at-CDN need extra setup.
- **What about serverless Postgres connection limits?** — Use pooling (PgBouncer, serverless drivers).

## Common Mistakes
- Running multiple replicas with the default in-memory cache and unstable encryption keys.
- Buffering proxies breaking streaming.
- Expecting runtime changes to `NEXT_PUBLIC_` variables.

## Tips
- Present the multi-instance checklist; it's the real content of this question.
