---
title: "How do environment variables work in Next.js: NEXT_PUBLIC_, build time vs runtime, and leaks"
level: medium
type: concept
tags: [environment-variables, next-public, build-time, runtime, secrets, dotenv]
related: [nextjs/data-access-layer, nextjs/vercel-vs-self-hosting, nextjs/server-vs-client-components]
---

## Question
How does Next.js load and expose environment variables? What is the difference between server-only and `NEXT_PUBLIC_` variables, when are they evaluated, and what typically goes wrong in CI/CD and Docker?

## Interview Answer
Next.js loads `.env*` files (`.env`, `.env.local`, `.env.development`, `.env.production`, with precedence rules and `.env.local` ignored in test) and makes variables available on the server through `process.env`. By default they are server-only. Variables prefixed with `NEXT_PUBLIC_` are inlined into the client JavaScript at build time, replacing literal `process.env.NEXT_PUBLIC_X` references with the value used during `next build`, so changing them later requires a rebuild and a Docker image built once can't be "promoted" across environments with different public values. Dynamic access such as `process.env[name]` isn't inlined. Server variables are read at runtime when they are read on the server in a dynamic context, but in statically prerendered pages they are baked into the output at build time. Secrets must never carry the `NEXT_PUBLIC_` prefix, and I keep their usage in a server-only data layer.

## Explanation
### Loading order (higher wins)

1. `process.env` (set by the shell/platform)
2. `.env.$(NODE_ENV).local`
3. `.env.local` (not loaded when `NODE_ENV=test`)
4. `.env.$(NODE_ENV)`
5. `.env`

`.env.local` is for secrets and local overrides and should be git-ignored. Variables can reference others: `URL=$HOST:$PORT`; escape `$` with `\$`.

### Server vs public

```ts
// server only (Server Components, actions, handlers, proxy)
const url = process.env.DATABASE_URL;

// client + server, inlined at build
const id = process.env.NEXT_PUBLIC_ANALYTICS_ID;
```

```ts
// NOT inlined: dynamic lookups
const key = "NEXT_PUBLIC_ANALYTICS_ID";
process.env[key];                    // undefined in the browser
const { NEXT_PUBLIC_ANALYTICS_ID } = process.env;   // destructuring is also not reliably inlined in all setups; use direct access
```

### When values are read

| Where | Evaluated |
|---|---|
| `NEXT_PUBLIC_*` in client code | build time (baked into the bundle) |
| Server var in a statically prerendered page | build time (baked into HTML) |
| Server var in a request-time render (dynamic, after `connection()`/`cookies()`), route handler, action, proxy | runtime |
| `next.config` `env` option | build time |

Because prerendered output bakes in values, reading a runtime secret during static rendering can embed it in HTML; keep secrets out of rendered output.

### Practical consequences
- **Build once, deploy many**: not possible for `NEXT_PUBLIC_` values. Options: build per environment, or fetch config at runtime from an API / server-rendered script tag (`window.__CONFIG__`) or a server component prop.
- **Docker**: pass `NEXT_PUBLIC_*` as build args; pass server secrets at run time (`docker run -e`), not in the image layers.
- **CI**: the build step needs any variable used for static generation (for example a CMS token) available at build time.
- **Vercel**: variables are scoped per environment (Production/Preview/Development) and require a redeploy to apply.
- `serverRuntimeConfig`/`publicRuntimeConfig` were removed in Next.js 16; use env vars.

### Safety
1. Never prefix secrets with `NEXT_PUBLIC_`.
2. Only the data access layer reads secrets; `import "server-only"` guards the module.
3. Validate env at startup with a schema (Zod, `@t3-oss/env-nextjs`) so missing values fail the build or boot, not production traffic.
4. Don't log environment objects.
5. Rotate leaked values immediately: bundles are public.

```ts
// env.ts
import "server-only";
import { z } from "zod";
export const env = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
}).parse(process.env);
```

### Testing
Use `loadEnvConfig` from `@next/env` to load `.env` files in test runners or scripts outside the Next runtime.

## Follow-ups
- **Why can't I change `NEXT_PUBLIC_API_URL` without rebuilding?** — It's replaced as a string literal in the compiled JavaScript.
- **Is `.env.local` loaded in production?** — Yes for `next start` if the file exists, but production platforms usually inject variables instead.

## Common Mistakes
- Exposing secrets through `NEXT_PUBLIC_`.
- Expecting runtime changes to affect public variables.
- Dynamic `process.env[...]` access on the client.

## Tips
- Explain "inlined at build time"; it explains most environment bugs.
