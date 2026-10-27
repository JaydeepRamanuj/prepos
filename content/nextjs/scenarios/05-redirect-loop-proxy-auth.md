---
title: "ERR_TOO_MANY_REDIRECTS after adding auth to proxy.ts"
level: medium
type: debugging
tags: [proxy, redirects, matcher, auth, loops, debugging]
related: [nextjs/proxy-ts-replaces-middleware, nextjs/optimistic-auth-checks-proxy, nextjs/next-config-essentials]
---

## Question
After deploying this `proxy.ts`, every page shows "This page isn't working: redirected you too many times". Explain the bug and fix it, then list other matcher mistakes that commonly cause outages.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const session = request.cookies.get("session");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
```

## Interview Answer
There is no `matcher`, so proxy runs on every request, including `/login`, static assets and images. A visitor without a session requests `/login`, the proxy redirects them to `/login` again, and so on. Fix it by excluding the login route and public assets, either with a negative-lookahead `matcher` or an allow-list check inside the function, and by redirecting only protected paths. I also check for cookie issues (the cookie may be set on a different path or domain), return early for `_next` and file requests, and remember proxy is only an optimistic check, so real authorisation stays in the DAL. For safety I add a redirect guard so already-redirected requests aren't redirected again.

## Explanation
### Fix 1: scope with `matcher`

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/account/:path*"],   // only protected areas
};
```

or exclude public paths:

```ts
export const config = {
  matcher: ["/((?!login|signup|api/public|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
```

### Fix 2: explicit logic

```ts
const PUBLIC = ["/login", "/signup", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  if (!request.cookies.has("session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);                 // return after login
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
```

Validate `next` on the server (same-origin relative path only) to avoid open redirects.

### Reverse case: logged-in users on `/login`

```ts
if (pathname === "/login" && request.cookies.has("session")) {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
```

Beware loops when `/dashboard` redirects back to `/login` because the cookie is present but invalid. Proxy only checks existence; the DAL decides validity, so make sure the dashboard handles an invalid session by clearing the cookie (in a Server Action/Route Handler) rather than bouncing, or have the proxy verify the signature cheaply.

### Other classic outages

| Mistake | Effect |
|---|---|
| No matcher | runs on `_next/static`, images, API; slows everything, loops |
| Matcher excludes `/api` but auth relies on proxy | API unprotected |
| Redirect uses `request.url` behind a proxy with a different host | redirects to internal hostname; use `request.nextUrl.clone()` or forwarded host |
| Cookie `Secure` on HTTP in staging | cookie not sent, endless login redirect |
| Cookie `Path`/`Domain` mismatch | proxy can't see it |
| Expensive work/DB call in proxy | latency spike for all matched requests |
| Prefetch requests treated as navigations | redirects triggered by `<Link>` prefetch; handle by ignoring `next-router-prefetch` where appropriate |
| Server Action path excluded by matcher | action calls skip the check; always verify inside the action |
| Dynamic values in `matcher` | ignored (must be constants) |

### Debugging approach
1. Look at the redirect chain in the Network tab (Preserve log): which URL repeats?
2. Log `pathname` and cookie presence in proxy (temporarily).
3. Test locally with `curl -I -L --max-redirs 5`.
4. Check the matcher against the failing path with the path-to-regexp semantics.
5. Fix, add a regression test (e2e: unauthenticated user can load `/login`; authenticated user can load `/dashboard`).

## Follow-ups
- **Why not auth fully in proxy?** — Coarse, matcher-dependent, can't authorise per resource; use DAL checks too.
- **Does proxy see Server Action POSTs?** — Yes, if the matcher matches the route they're posted to.

## Common Mistakes
- Forgetting to exclude the login page and assets.
- Using `request.url` for redirects behind proxies.
- Treating cookie existence as proof of authentication.

## Tips
- Show both the matcher fix and the in-function guard.
