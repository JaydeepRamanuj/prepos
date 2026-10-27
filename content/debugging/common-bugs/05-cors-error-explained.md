---
title: "You get a CORS error calling your API. What is actually happening and how do you fix it?"
level: medium
type: debugging
tags: [cors, preflight, http, cookies, fetch]
related: [debugging/works-locally-not-in-production, debugging/chrome-devtools-beyond-console-log, scenarios/security-issue-in-teammate-pr]
---

## Question
Your React app on `https://app.shop.com` calls `https://api.shop.com/cart` and the console says:

```txt
Access to fetch at 'https://api.shop.com/cart' from origin 'https://app.shop.com' has been
blocked by CORS policy: Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

```ts
await fetch("https://api.shop.com/cart", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ productId: "p1" }),
});
```

A teammate suggests installing a "disable CORS" browser extension. What is really going on, and what is the correct fix?

## Interview Answer
CORS is the browser enforcing the same-origin policy: a page from one origin can send requests to another, but the browser only lets JavaScript read the response if the server explicitly allows that origin through `Access-Control-Allow-*` headers. Here the request is not "simple" — it uses JSON content type and an `Authorization` header — so the browser first sends an `OPTIONS` preflight, and the API isn't answering it with the right headers. The fix is on the server: respond to `OPTIONS` and to the real request with `Access-Control-Allow-Origin: https://app.shop.com` (the exact origin, not `*`, because we send credentials), `Access-Control-Allow-Credentials: true`, and the allowed methods and headers. Alternatively, put the API behind the same origin with a reverse proxy or a Next.js rewrite/route handler, which removes CORS entirely. A disable-CORS extension only changes my browser; every real user would still be blocked.

## Explanation
### Who blocks what
CORS is **not** a server security feature, and it doesn't stop the request from reaching the server (a simple POST is still executed). It is the **browser** refusing to hand the response to your JS. That's why curl and Postman "work" — they don't enforce CORS.

### Simple request vs preflight

```txt
Browser                                  api.shop.com
  │ OPTIONS /cart                           │
  │ Origin: https://app.shop.com            │
  │ Access-Control-Request-Method: POST     │
  │ Access-Control-Request-Headers:         │
  │   authorization, content-type           │
  │────────────────────────────────────────▶│
  │◀──── 204 + Access-Control-Allow-* ──────│   ← this is what's missing
  │ POST /cart (real request)               │
  │────────────────────────────────────────▶│
  │◀──── 200 + Access-Control-Allow-Origin ─│
```

A request skips preflight only if it uses GET/HEAD/POST, only CORS-safelisted headers, and a `Content-Type` of `text/plain`, `multipart/form-data` or `application/x-www-form-urlencoded`. JSON bodies and `Authorization` headers trigger a preflight.

### Correct server fix (Express example)

```ts
import cors from "cors";

const allowed = new Set(["https://app.shop.com", "http://localhost:3000"]);

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)), // echo only allow-listed origins
    credentials: true, // → Access-Control-Allow-Credentials: true
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600, // cache the preflight result for 10 minutes
  }),
);
```

Rules worth knowing:
- With `credentials: "include"`, `Access-Control-Allow-Origin` **cannot be `*`**; it must be the exact origin.
- When you echo the origin dynamically, also send `Vary: Origin` so caches don't serve one origin's response to another (the `cors` package does this).
- The preflight must succeed with a 2xx and must not require auth — the browser never sends cookies or `Authorization` on `OPTIONS`.
- Cookies across sites also need `SameSite=None; Secure` — that's a cookie rule, separate from CORS.

### Avoiding CORS: same origin
Proxy the API through your own domain so the browser sees one origin:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: "https://api.shop.com/:path*" }];
  },
};
export default nextConfig;
```

In development, Vite's `server.proxy` does the same.

### Debugging checklist
1. Network tab → find the `OPTIONS` request. Is it there? What status? Which headers came back?
2. Is the error really CORS? A 500 or 404 from the API often has no CORS headers and *shows up* as a CORS error. Check the server logs.
3. Does the allowed origin match exactly — scheme, host, **port**, no trailing slash?

## Follow-ups
- **Does CORS protect the API from attackers?** — No. Any non-browser client can call it. CORS protects users: it stops a malicious site from reading responses using the user's cookies. Server-side auth and CSRF protection are still needed.
- **Why does `mode: "no-cors"` "fix" it?** — It sends the request but gives you an opaque response you can't read, so it's useless for APIs.
- **Why does the error mention preflight when I sent a POST?** — The browser sent `OPTIONS` first; your POST never left the browser.

## Common Mistakes
- Using `Access-Control-Allow-Origin: *` together with credentials (browsers reject it).
- Adding CORS headers in the frontend fetch call — they're response headers; the server must send them.
- Requiring authentication on the `OPTIONS` route, so the preflight gets a 401.
- Shipping a "disable CORS" extension or flag as a fix.

## Tips
- Lead with "CORS is enforced by the browser, configured by the server".
- Show you can read the Network panel: find the preflight, check its response headers.
