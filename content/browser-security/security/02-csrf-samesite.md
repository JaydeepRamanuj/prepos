---
title: "CSRF: how it works, SameSite cookies, CSRF tokens and Server Actions"
level: medium
type: concept
tags: [csrf, samesite, cookies, csrf-token, origin-check, server-actions, cors]
related: [browser-security/cookie-flags-token-storage, browser-security/cors-preflight, browser-security/csp-xss-basics]
---

## Question
What is CSRF, and how do `SameSite` cookies, CSRF tokens and Origin checks defend against it? Does CORS protect you? How are Next.js Server Actions affected?

## Interview Answer
Cross-Site Request Forgery tricks a logged-in user's browser into sending a state-changing request to your site from another site, e.g. a hidden form on `evil.com` posting to `bank.com/transfer`. It works because browsers automatically attach cookies for the target site, so the server sees an authenticated request. Defences stack: **`SameSite` cookies** (`Lax` is the browser default now; `Strict` for the most sensitive) stop the cookie being sent on cross-site POSTs and subresource requests; **CSRF tokens** (synchroniser token or signed double-submit cookie) require a secret value in a header or form field that attackers cannot read cross-origin; **Origin/Referer (and `Sec-Fetch-Site`) verification** rejects requests not coming from your site; and requiring a custom header or `Content-Type: application/json` on APIs forces a CORS preflight that cross-site forms cannot satisfy. Never change state with GET. CORS alone is not protection because it only controls whether a page can *read* a response, while simple cross-site form posts are still *sent*. Next.js Server Actions only accept POST and compare the `Origin` header with the host, which gives built-in CSRF protection.

## Explanation
### Attack
```html
<!-- on evil.com, victim is logged in to bank.com -->
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="10000">
</form>
<script>document.forms[0].submit()</script>
```
Before SameSite, the browser would attach the `bank.com` session cookie, and the transfer would succeed.

### Same-site vs same-origin
**Site** = registrable domain (eTLD+1) plus scheme. `app.example.com` and `api.example.com` are the same site but different origins. SameSite rules operate on *site*, CORS on *origin*. A subdomain you don't control (e.g. a takeover) can still send same-site requests.

### SameSite values

| Value | Cookie sent on… |
|---|---|
| `Strict` | only same-site requests (even following an external link starts without the cookie) |
| `Lax` (default in modern browsers) | same-site requests and top-level GET navigations from other sites; not cross-site POST, iframes, `fetch`, images |
| `None` (requires `Secure`) | all requests, needed for cross-site embeds and third-party contexts |

`Lax` blocks classic CSRF via POST but allows state changes made with GET navigations, so never mutate on GET. Some browsers apply a short "Lax+POST" grace period for cookies without an explicit attribute, so set it explicitly.

### Defence layers
1. **SameSite=Lax/Strict** on session cookies (first line, but not sufficient alone: subdomains, older browsers, `None` requirements).
2. **CSRF token:**
   - *Synchroniser token*: server stores a random token in the session and embeds it in forms/meta tag; validate on each mutation.
   - *Double-submit cookie*: set a random value in a cookie and require the same value in a header (`X-CSRF-Token`); sign/bind it to the session to avoid subdomain cookie injection.
3. **Origin verification:** compare `Origin` (or `Referer`) to an allowlist on mutating requests; also `Sec-Fetch-Site: same-origin` where present.
4. **Content-Type / custom header:** JSON APIs reject `text/plain`/form encodings, forcing preflight for cross-origin calls (not a substitute for tokens in cookie-auth apps, but a useful layer).
5. **Re-authentication** for sensitive actions (password change, payment).
6. **Bearer tokens in `Authorization` headers** are not auto-attached by the browser, so classic CSRF doesn't apply (but token storage then has XSS exposure).

### Does CORS protect against CSRF?
No. Preflighted requests are blocked, but simple requests (form posts) reach the server and take effect even if the attacker can't read the response. Rely on SameSite, tokens and Origin checks.

### Next.js
- **Server Actions** are POST-only and Next.js compares the `Origin` header with the `Host`/`X-Forwarded-Host`; mismatches are rejected. Additional trusted origins go in `serverActions.allowedOrigins`. Still authenticate and authorise inside every action, and treat arguments as untrusted input.
- **Route Handlers** are *not* automatically protected; for cookie-authenticated POST/PUT/DELETE handlers, check Origin and/or a token.
- Auth libraries (Auth.js, etc.) include CSRF handling for their endpoints.

```ts
// Minimal Origin check for a cookie-authenticated route handler
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin !== process.env.APP_ORIGIN) return new Response("Forbidden", { status: 403 });
  // …authenticate session cookie, then mutate
}
```

### Related attacks
- **Login CSRF:** attacker logs the victim into the attacker's account; protect login forms too.
- **Clickjacking:** framing your page; use `frame-ancestors`.
- **CSWSH** (cross-site WebSocket hijacking): validate `Origin` on the handshake.
- **XSS defeats CSRF protections** because script can read tokens; fix XSS first.

## Follow-ups
- **If cookies are `SameSite=Strict`, do you still need tokens?** — Defence in depth says yes for sensitive apps (subdomain risk, browser quirks), though many apps accept Strict/Lax plus Origin checks.
- **Why does `SameSite=None` exist?** — Legitimate cross-site contexts such as embedded widgets, payment frames and SSO.

## Common Mistakes
- Believing CORS prevents CSRF.
- Mutating state with GET.
- Skipping CSRF checks on Route Handlers because "Next.js handles it".

## Tips
- Explain why the browser's automatic cookie attachment is the root cause.
