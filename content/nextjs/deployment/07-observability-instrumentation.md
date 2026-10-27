---
title: "Production readiness: instrumentation, logging, after() and error monitoring"
level: advanced
type: design
tags: [instrumentation, opentelemetry, after, logging, sentry, observability, production-checklist]
related: [nextjs/vercel-vs-self-hosting, nextjs/web-vitals-measurement, nextjs/server-action-error-handling]
---

## Question
Before launching a Next.js 16 app you are asked: how will we know when it breaks and why it is slow? Describe how you'd add tracing, structured logging and error reporting, which Next.js hooks you'd use, and how to run work after the response without delaying users.

## Clues
- A special file runs once when the server starts.
- Some work (analytics, cache warming) should happen after the response has been sent.
- Client and server errors need separate capture, linked by a digest or request id.

## Interview Answer
I use `instrumentation.ts` at the project root, whose `register()` function runs once when the server instance starts, to initialise OpenTelemetry (or a vendor SDK such as Sentry or Datadog) so Next.js emits spans for requests, rendering, fetches and route handlers; an optional `onRequestError` export receives server errors with request and route context so I can report them to monitoring. For the browser, `instrumentation-client` runs early on the client for error and performance monitoring, and `useReportWebVitals` sends Core Web Vitals. Logs are structured JSON with request ids, never plain `console.log` strings with PII. For fire-and-forget work such as analytics events or audit logs, I use `after()` from `next/server`, which schedules a callback to run after the response finishes streaming, without blocking users, as long as the platform keeps the invocation alive. Error boundaries (`error.tsx`, `global-error.tsx`) provide user-facing fallbacks, and the error `digest` lets me correlate a user's report with the server log.

## Explanation
### `instrumentation.ts`

```ts
// instrumentation.ts (project root, or src/)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");     // OTel SDK setup; keep Node-only imports out of Edge
  }
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string }
) {
  await reportError(err as Error, { path: request.path, route: context.routePath, type: context.routeType });
}
```

With `@vercel/otel` or the OpenTelemetry Node SDK you get spans such as `GET /products/[id]`, render and fetch spans, exported via OTLP to your backend.

### Client side

```ts
// instrumentation-client.ts: runs before the app becomes interactive
import * as Sentry from "@sentry/nextjs";
Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1 });
```

### `after()`

```tsx
import { after } from "next/server";

export async function POST(req: Request) {
  const order = await createOrder(await req.json());
  after(async () => {
    await analytics.track("order_created", { id: order.id });   // runs after the response is sent
    await auditLog.write(order.id);
  });
  return Response.json({ id: order.id });
}
```

Works in Server Components, Server Actions, Route Handlers and proxy, and it is not a request-time API, so calling it doesn't make a route dynamic (in a static page the callback runs at build time or on revalidation). Inside Route Handlers and Server Functions you can read `cookies()` and `headers()` within the callback; in Server Components you can't, so read the values first and close over them. On self-hosted servers the process must stay alive (graceful shutdown waits for pending `after` tasks); serverless platforms extend the invocation (`waitUntil`).

### Logging
- JSON logs: `{ level, msg, requestId, route, userId (hashed), durationMs }`.
- Generate/propagate a request id in proxy (`x-request-id`) and include it in logs and responses.
- Do not log secrets, tokens, full request bodies or personal data.
- In production, Server Component errors shown to users are sanitised; the `digest` links to the real error in logs.

### Error handling layers
1. `error.tsx` per segment: contained failures with retry.
2. `global-error.tsx`: errors in the root layout.
3. Server Actions: return expected errors, throw unexpected ones.
4. `onRequestError`: catch-all server reporting.
5. Alerts: error-rate, latency percentiles, 5xx counts, failed deploy checks.

### Production checklist (high level)
- Run `next build` and `next start` locally; check bundle sizes and warnings.
- Caching: tags, `cacheLife`, shared handler for multi-instance.
- Security: headers/CSP, auth in the DAL, Server Action origin config, env validation.
- Performance: Web Vitals RUM, image/font optimisation, third-party audit.
- SEO: metadata, sitemap, robots, canonical URLs.
- Reliability: health checks, graceful shutdown, retries/timeouts for upstreams, rate limits.
- Rollback: immutable builds, `deploymentId`, ability to revert quickly.
- Documentation and runbooks for incidents.

### Metrics worth dashboarding
Request rate, error rate, p50/p95/p99 latency per route, cache hit ratio, ISR regeneration time, TTFB, Web Vitals p75, server memory/CPU, event loop lag, DB query time.

## Follow-ups
- **Does `register()` run per request?** — No, once per server instance start.
- **Can I use `console.log` in `after`?** — Yes, but prefer your structured logger/exporter.

## Common Mistakes
- Initialising Node-only SDKs in Edge contexts (check `NEXT_RUNTIME`).
- Awaiting analytics inside the request instead of using `after()`.
- Logging PII.

## Tips
- Mention `digest` correlation; it connects client error screens to server logs.
