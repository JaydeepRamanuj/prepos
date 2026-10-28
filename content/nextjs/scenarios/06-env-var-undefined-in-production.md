---
title: "An environment variable is undefined in production (but works locally)"
level: medium
type: debugging
tags: [environment-variables, build-time, docker, next-public, deployment, debugging]
related: [nextjs/environment-variables, nextjs/vercel-vs-self-hosting, nextjs/data-access-layer]
---

## Question
`process.env.NEXT_PUBLIC_API_URL` is correct locally, but in production the browser calls `undefined/users`. Another variable, `STRIPE_SECRET`, works in API routes but is `undefined` in a client component. Explain both bugs and give a checklist for diagnosing env var problems on Vercel and in Docker.

## Interview Answer
Public variables are inlined into the client bundle at build time, so if `NEXT_PUBLIC_API_URL` wasn't present in the environment where `next build` ran (it was added to the platform after the build, set only at container runtime, or defined in a different environment scope), the compiled code contains `undefined`. Setting it at runtime doesn't help; I need to set it in the build environment and rebuild, or move to a runtime config approach. `STRIPE_SECRET` lacks the `NEXT_PUBLIC_` prefix, so it is deliberately not exposed to the browser: it's only available in server code. The correct design is to keep the secret on the server and call Stripe from a Server Action or route handler. For diagnosis: check where it's defined (platform scope, `.env.production`, Docker build args vs run-time env), whether the build log shows it, whether access is dynamic (`process.env[name]` isn't inlined), and whether a redeploy happened after the change.

## Explanation
### Why local works
`next dev` reads `.env.local`, and the dev server re-reads files. A production build only sees variables present at build time, and deployments only change when rebuilt.

### Bug 1: `NEXT_PUBLIC_` baked at build

```ts
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`);
// compiled client code: fetch(`${"https://api.example.com"}/users`) or `${undefined}`
```

Fixes, depending on the situation:
- Add the variable to the build environment (CI secrets, Vercel project env for the right environment: Production/Preview), then rebuild/redeploy.
- Docker: pass as a build argument and `ENV` before `npm run build`; setting `docker run -e` is too late for public vars.
- If you need one build to run in several environments: avoid public env vars for configuration. Options: fetch config from a server endpoint at startup, render config into the HTML from a Server Component (`<script>` with JSON, careful with escaping), or proxy API calls through the Next.js server with a server-side base URL.
- Using the same-origin path `/api/...` and rewrites avoids needing the URL in the client.

### Bug 2: secret in the client

```tsx
"use client";
const key = process.env.STRIPE_SECRET;   // undefined by design
```

Don't "fix" this by renaming it `NEXT_PUBLIC_STRIPE_SECRET`: that publishes the secret. Move the Stripe call into a Server Action, route handler or DAL (`import "server-only"`), and send only the client secret or session id to the browser. Public keys (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) are designed to be public.

### Dynamic access isn't inlined

```ts
const name = "NEXT_PUBLIC_API_URL";
process.env[name];          // undefined in the browser
```

### Checklist

1. **Where is it defined?** `.env`, `.env.production`, platform dashboard, CI secret, Docker build arg, Kubernetes secret.
2. **Which scope?** On Vercel, variables are per environment; a Preview deployment won't have Production-only vars.
3. **Public or server?** Prefix correctly and consider exposure.
4. **Build vs runtime?** Public: build. Server: runtime for dynamic routes; build for statically generated pages that read them.
5. **Was there a rebuild** after changing it? Vercel needs a new deployment for changed vars.
6. **Dynamic access / destructuring** patterns that defeat inlining.
7. **Load order**: shell variables override `.env` files.
8. **Whitespace/quotes/line endings** in values (`"value"` vs `value`; Windows CRLF).
9. **`next.config` `env`** option values are build-time too.
10. **Validation**: parse env with Zod at startup; log missing names (not values).

### Prevention
- An `env.ts` schema that fails the build when required variables are missing.
- CI step that prints variable names (not values) available to the build.
- Documentation of which variables are build-time vs run-time.
- Avoid putting secrets in Docker image layers (build args are visible in image history); use BuildKit secrets for build-time secrets.

## Follow-ups
- **Can `NEXT_PUBLIC_` be changed without a rebuild?** — No; they're string-replaced in the compiled JS.
- **Why did the server code work?** — Server variables are read from the process environment at runtime in API routes and dynamic renders.

## Common Mistakes
- Adding `NEXT_PUBLIC_` to a secret to make the error go away.
- Setting public vars only at container runtime.
- Forgetting to redeploy.

## Tips
- Say "inlined at build" immediately, then address the security angle.
