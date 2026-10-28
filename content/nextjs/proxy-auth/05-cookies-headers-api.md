---
title: "Working with cookies() and headers() in Next.js 16: where can you read and write?"
level: medium
type: concept
tags: [cookies, headers, async-request-apis, server-actions, route-handlers, proxy]
related: [nextjs/runtime-apis-dynamic-rendering, nextjs/session-cookies-stateless-vs-database, nextjs/proxy-ts-replaces-middleware]
---

## Question
How do you read and set cookies and headers in the App Router? Where is each allowed, why is "Cookies can only be modified in a Server Action or Route Handler" an error, and what changed about these APIs in Next.js 15/16?

## Interview Answer
`cookies()` and `headers()` from `next/headers` are async since Next.js 15, so you `await` them, which is what lets Next.js pause just the component that needs request data. Reading works in Server Components, Server Actions, Route Handlers and proxy via `request.cookies`; writing cookies (`set`, `delete`) is only allowed in Server Actions and Route Handlers (and proxy through the response), because a Server Component renders while the response is already streaming and can't set headers anymore. Headers are read-only through `headers()`. Reading either one opts that component into request-time rendering, so with Cache Components it needs a Suspense boundary, and you can't call them inside a `"use cache"` scope. For setting response headers globally, use `next.config` `headers` or proxy.

## Explanation
### Reading

```tsx
import { cookies, headers } from "next/headers";

export default async function Page() {
  const theme = (await cookies()).get("theme")?.value ?? "light";
  const ua = (await headers()).get("user-agent");
  return <p>{theme} / {ua}</p>;
}
```

### Writing: Server Action or Route Handler

```ts
"use server";
import { cookies } from "next/headers";

export async function setTheme(theme: "light" | "dark") {
  (await cookies()).set("theme", theme, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}
```

```ts
// app/api/logout/route.ts
export async function POST() {
  (await cookies()).delete("session");
  return new Response(null, { status: 204 });
}
```

### In proxy

```ts
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.has("visitor")) res.cookies.set("visitor", crypto.randomUUID(), { httpOnly: true });
  return res;
}
```

### Why writing is restricted
HTTP cookies travel in response headers. With streaming, Next.js sends headers with the first chunk, before all Server Components have rendered. A component that tries to set a cookie later cannot change headers already sent. Server Actions and Route Handlers produce their own response, so they can.

### Where each API works

| Context | Read cookies | Write cookies | Read headers |
|---|---|---|---|
| Server Component | ✅ | ❌ | ✅ |
| Server Action | ✅ | ✅ | ✅ |
| Route Handler | ✅ | ✅ | ✅ (or `request.headers`) |
| Proxy | `request.cookies` | `response.cookies` | `request.headers` |
| Client Component | `document.cookie` / library | same | n/a |
| `"use cache"` scope | ❌ pass values in | ❌ | ❌ |

### Behaviour notes
- After a Server Action sets or deletes a cookie, Next.js refreshes the page's client cache so new data (like a logged-in state) shows up immediately.
- `cookies().set` in a Server Action then `redirect()`: cookie is applied before the redirect response.
- Reading a cookie in a layout makes everything below dynamic unless isolated; push reads into leaf components behind Suspense.
- `draftMode()` is a related API for preview mode.
- Typing: `cookies()` returns a read-only store in Server Components (writing throws); use `ResponseCookies` in handlers.
- Cookie size limits are around 4 KB per cookie; don't stash big payloads there.

### What changed
| Version | Change |
|---|---|
| 14 | synchronous `cookies()` / `headers()`; calling them made the whole route dynamic |
| 15 | async APIs (sync access deprecated with warnings) |
| 16 | sync access removed; with Cache Components they identify request-time holes; `middleware` → `proxy` |

Codemod `next-async-request-api` handles most migrations.

## Follow-ups
- **Can a client component read an `httpOnly` cookie?** — No, by design.
- **Where do I set a locale cookie on first visit?** — Proxy (response cookie), or a Server Action when the user picks one.

## Common Mistakes
- Setting cookies during render.
- Forgetting `await`.
- Using cookies inside cached functions.

## Tips
- Link the restriction to streaming: headers are already sent.
