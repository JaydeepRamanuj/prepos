---
title: "Where should auth checks live: proxy, layouts, pages or the data layer?"
level: hard
type: design
tags: [authentication, authorization, proxy, layouts, partial-rendering, data-access-layer]
related: [nextjs/proxy-ts-replaces-middleware, nextjs/data-access-layer, nextjs/server-actions-are-public-endpoints, nextjs/session-cookies-stateless-vs-database]
---

## Question
A team puts `if (!session) redirect('/login')` in the dashboard layout and also in `proxy.ts`. A user logs out in one tab and keeps navigating in another, and a Server Action in the dashboard is reachable without a session. Explain what is wrong and design the layers properly.

## Clues
- Layouts don't re-render on every client navigation (partial rendering).
- Proxy runs before routing but is easy to misconfigure and doesn't cover everything.
- Data and actions must verify access themselves.

## Interview Answer
Auth checks should live as close to the data as possible, with cheaper checks earlier only as optimisations. Proxy is good for optimistic checks: reading the session cookie and redirecting obvious unauthenticated users before rendering. It shouldn't be the only guard because it's a coarse, path-based filter and doesn't see individual resources or Server Function calls on excluded paths. Layouts are risky for checks because they persist across client navigations between child routes, so a check there doesn't re-run when moving between pages, and a layout doesn't stop its pages or parallel slots from rendering. The reliable place is a data access layer that verifies the session and permissions on every read and write, plus checks in page components for redirects and in Server Actions and Route Handlers that act as separate entry points. In the scenario, the layout check doesn't re-run on in-app navigation, and the Server Action has no verification, so I'd add a `verifySession()` call to the DAL and every action.

## Explanation
### The layers

| Layer | Purpose | Strength | Weakness |
|---|---|---|---|
| `proxy.ts` | optimistic redirect for unauthenticated users | fast, runs before rendering | path-based, bypassable by matcher gaps, no per-resource logic, keep it cookie-only |
| Layout | shared UI like nav | can show user info | doesn't re-render on child navigation; doesn't block pages or slots |
| Page / Server Component | redirect or show UI based on session | easy and visible | only covers rendering of that component |
| **Data access layer** | verify session + permissions per read/write; return DTOs | single source of truth; can't forget | needs discipline: all access via the DAL |
| Server Actions / Route Handlers | verify again | they are separate POST/HTTP entry points | each needs its own call |

### Code

```ts
// lib/dal.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const verifySession = cache(async () => {
  const token = (await cookies()).get("session")?.value;
  const session = await decrypt(token);            // verify signature/expiry (or look up DB session)
  if (!session?.userId) redirect("/login");
  return { userId: session.userId, role: session.role };
});

export const getUser = cache(async () => {
  const { userId } = await verifySession();
  const user = await db.user.findUnique({ where: { id: userId } });
  return user && { id: user.id, name: user.name };  // DTO: only safe fields
});

export async function getInvoice(id: string) {
  const { userId, role } = await verifySession();
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice || (invoice.ownerId !== userId && role !== "admin")) return null;   // authorisation
  return invoice;
}
```

```ts
// proxy.ts: optimistic only
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("session");
  if (!hasSession && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
```

```ts
// action: its own check
"use server";
export async function updateProfile(fd: FormData) {
  const { userId } = await verifySession();
  /* validate, write */
}
```

### Why layouts are tricky
- Navigating `/dashboard/a` → `/dashboard/b` reuses the layout instance, so its `await verifySession()` doesn't run again; the session could have expired.
- A layout that hides or swaps slots or children doesn't stop them from executing; they still run and can fetch data.
- Top-level `await cookies()` in a layout also delays streaming; move session reads into a nested Server Component behind Suspense (nav user menu) and enforce access in the DAL.

### Dealing with the logged-out-in-another-tab case
Data fetches go through the DAL, so the next navigation that requests new RSC payload for pages/data triggers `verifySession()` and redirects. For immediate UX, add a client-side session listener (BroadcastChannel/storage event) to refresh or redirect.

### `forbidden()` and `unauthorized()`
Next.js has `forbidden()` (403) and `unauthorized()` (401) functions with matching `forbidden.tsx`/`unauthorized.tsx` files when enabled (experimental `authInterrupts`). Use them to model auth failures in pages and actions rather than throwing generic errors.

### Rules of thumb
1. Never trust a layout or proxy alone.
2. Authenticate and authorise in the DAL and in every action/handler.
3. Return DTOs, not rows.
4. Memoise the session lookup with `cache()` so checking is cheap.
5. Put UI niceties (hide admin buttons) in leaves, but treat them as cosmetic.

## Follow-ups
- **JWT in the proxy: can I fully verify there?** — Verifying a signed cookie is feasible, but you can't check revocation without a lookup; hence "optimistic".
- **Auth libraries?** — Auth.js, Clerk, Better Auth, Lucia-style patterns: they still need DAL-level checks.

## Common Mistakes
- Layout-only protection.
- Relying on hidden UI as security.
- Passing the full user row to Client Components.

## Tips
- Say "optimistic in proxy, authoritative in the DAL".
