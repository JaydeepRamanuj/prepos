---
title: "CORS: same-origin policy, preflight requests and fixing common errors"
level: medium
type: concept
tags: [cors, same-origin-policy, preflight, credentials, headers, options]
related: [browser-security/http-caching, browser-security/csrf-samesite, browser-security/cookie-flags-token-storage]
---

## Question
What problem does CORS solve? Explain the same-origin policy, simple vs preflighted requests, the key response headers, how credentials change things, and how you would debug "blocked by CORS policy".

## Interview Answer
The same-origin policy stops a page from one origin (scheme + host + port) from *reading* responses from another origin. CORS is the opt-in mechanism by which a server says "this other origin may read my responses" using headers like `Access-Control-Allow-Origin`. It is enforced by the browser, not the server, and it protects the user's browser, not your API from curl. "Simple" requests (GET/HEAD/POST with only safe headers and content types like `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`) are sent directly and the browser decides whether JavaScript may read the response. Anything else (JSON `Content-Type`, custom headers such as `Authorization`, methods like PUT/DELETE) triggers a **preflight**: an automatic `OPTIONS` request with `Access-Control-Request-Method` and `-Headers`; only if the server replies with matching `Access-Control-Allow-*` headers does the browser send the real request. With cookies (`credentials: "include"`) the server must return a specific origin (not `*`) and `Access-Control-Allow-Credentials: true`.

## Explanation
### Origin
`https://app.example.com:443` is the tuple (https, app.example.com, 443). `https://example.com` and `https://api.example.com` are different origins, and so are `http` vs `https` or different ports.

### Flow

```txt
Browser (https://app.com)                       API (https://api.com)
  fetch(PUT /items, JSON, Authorization)
  ── OPTIONS /items ───────────────────────────►
     Origin: https://app.com
     Access-Control-Request-Method: PUT
     Access-Control-Request-Headers: authorization, content-type
  ◄── 204 ────────────────────────────────────
     Access-Control-Allow-Origin: https://app.com
     Access-Control-Allow-Methods: PUT
     Access-Control-Allow-Headers: authorization, content-type
     Access-Control-Max-Age: 600
  ── PUT /items (actual) ──────────────────────►
  ◄── 200 + Access-Control-Allow-Origin: https://app.com
```

### Response headers

| Header | Purpose |
|---|---|
| `Access-Control-Allow-Origin` | the allowed origin (or `*` without credentials) |
| `Access-Control-Allow-Methods` | methods allowed in preflight |
| `Access-Control-Allow-Headers` | request headers allowed |
| `Access-Control-Allow-Credentials: true` | allow cookies/auth; origin must be explicit |
| `Access-Control-Expose-Headers` | response headers JS may read beyond the safelisted ones |
| `Access-Control-Max-Age` | cache the preflight result (seconds) |
| `Vary: Origin` | needed when the allowed origin varies per request, so caches don't mix responses |

### Credentials
```ts
fetch("https://api.com/me", { credentials: "include" });
```
The server must respond with `Access-Control-Allow-Origin: https://app.com` (exactly, not `*`) and `Access-Control-Allow-Credentials: true`, otherwise the browser blocks the response. The cookie itself must also be allowed to travel cross-site (`SameSite=None; Secure`) or the sites must be same-site.

### Server implementation sketch
```ts
const allowed = new Set(["https://app.example.com"]);

export function cors(req: Request) {
  const origin = req.headers.get("origin");
  const headers = new Headers({ Vary: "Origin" });
  if (origin && allowed.has(origin)) {                       // allowlist; never reflect arbitrary origins
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
      headers.set("Access-Control-Allow-Headers", "content-type, authorization");
      headers.set("Access-Control-Max-Age", "600");
      return new Response(null, { status: 204, headers });
    }
  }
  return headers;
}
```

### Debugging checklist
1. Read the exact console message; it names the missing header or failed check.
2. Inspect the **preflight** in the Network tab (filter by OPTIONS). Often the server returns 404/405/401 for OPTIONS (auth middleware blocking unauthenticated preflights).
3. Wildcard with credentials is invalid.
4. Header lists: every custom request header must be in `Allow-Headers`.
5. Redirects: preflights must not be redirected.
6. A 500 error response without CORS headers appears as a CORS error even though the real problem is server-side.
7. Mixed-content, ad blockers and wrong URLs also show up as network errors.

### Avoiding CORS
- Same-origin deployment, or a reverse proxy/BFF so the browser only talks to your origin.
- Next.js: call the backend from Server Components/Route Handlers or use `rewrites`; CORS applies only to browser-initiated cross-origin requests, not server-to-server.
- `mode: "no-cors"` gives an opaque response you cannot read; it is not a fix.

### Security notes
- CORS is **not** CSRF protection: simple cross-site form posts still *send* cookies; CORS only controls reading the response (see SameSite and CSRF tokens).
- `Access-Control-Allow-Origin: *` is fine for truly public, unauthenticated resources; never combine with credentials.
- Do not reflect the `Origin` header blindly or accept `null`.
- Related isolation headers (COOP/COEP/CORP) protect against cross-origin leaks and enable features like `SharedArrayBuffer`.

## Follow-ups
- **Why does the browser preflight at all?** — Servers built before CORS never expected cross-origin PUT/DELETE or custom headers, so the browser asks permission first.
- **Do `<img>` and `<script>` tags need CORS?** — No for loading; yes if you read pixels in a canvas or use `crossorigin` for SRI and error details.

## Common Mistakes
- Thinking CORS is a server security feature that blocks other clients.
- Setting CORS headers only on the success path.
- Using `*` with cookies.

## Tips
- Walk through the preflight sequence out loud; it demonstrates real understanding.
