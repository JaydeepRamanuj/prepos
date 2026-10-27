---
title: "Cookie flags and where to store auth tokens: HttpOnly cookies vs localStorage"
level: hard
type: concept
tags: [cookies, httponly, secure, samesite, localstorage, jwt, refresh-token, session]
related: [browser-security/csp-xss-basics, browser-security/csrf-samesite, browser-security/browser-storage-options]
---

## Question
Explain the important cookie attributes, and argue for where a SPA or Next.js app should store session or access tokens: `localStorage`, memory, or cookies. What about refresh tokens?

## Clues
- Every storage option is a trade-off between XSS exposure and CSRF exposure.
- `HttpOnly` stops JavaScript from reading a cookie, not from using the session.
- Token lifetime and rotation limit damage.

## Interview Answer
Session cookies should be `HttpOnly` (invisible to JavaScript, so XSS can't read or exfiltrate them), `Secure` (HTTPS only), `SameSite=Lax` or `Strict` (CSRF mitigation), scoped with `Path` and no broader `Domain` than needed, and given a sensible `Max-Age`; the `__Host-` name prefix enforces Secure, `Path=/` and no Domain. For tokens, `localStorage` is readable by any script on the page, so a single XSS (including one in a third-party dependency) leaks the token and it can be used from the attacker's machine. An `HttpOnly` cookie can't be stolen that way, though XSS can still make same-origin requests as the user, and cookie auth needs CSRF defences. So my default for first-party web apps is a server-managed session or short-lived access token in an `HttpOnly; Secure; SameSite` cookie, with refresh handled server-side; for SPAs that must hold a bearer token I keep a short-lived access token in memory only and use a rotated refresh token in an `HttpOnly` cookie scoped to the refresh endpoint. I avoid putting long-lived tokens in `localStorage`.

## Explanation
### Attributes

| Attribute | Effect |
|---|---|
| `HttpOnly` | not accessible via `document.cookie`; still sent with requests |
| `Secure` | only sent over HTTPS (plus localhost in dev) |
| `SameSite=Strict/Lax/None` | controls cross-site sending (None requires Secure) |
| `Domain` | omitted = host-only (safer); set = includes subdomains |
| `Path` | limits which URLs receive it (not a security boundary against XSS) |
| `Max-Age` / `Expires` | lifetime; omit for a session cookie |
| `Partitioned` (CHIPS) | per-top-level-site storage for third-party contexts |
| Prefixes `__Secure-`, `__Host-` | browser enforces Secure (and for `__Host-`: Path=/, no Domain) |

```http
Set-Cookie: __Host-session=9f3a…; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800
```

In Next.js:

```ts
import { cookies } from "next/headers";

export async function createSession(token: string) {
  (await cookies()).set("__Host-session", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}
```

### Storage options compared

| Storage | XSS can read it? | Sent automatically (CSRF risk)? | Survives refresh/tabs? | Notes |
|---|---|---|---|---|
| `localStorage` / `sessionStorage` | **Yes** | No | yes / per tab | simple; most exposed to XSS |
| JS memory (variable) | Yes while the page lives, harder to scrape persistently | No | No (lost on reload) | needs silent refresh on load |
| Cookie, not HttpOnly | Yes | Yes | yes | worst of both |
| Cookie `HttpOnly; Secure; SameSite` | **No** (but XSS can still call APIs) | Yes (mitigated by SameSite + tokens) | yes | recommended default |

Key nuance: HttpOnly doesn't make XSS harmless; it prevents *token theft* and persistent offline abuse, leaving the attacker limited to acting inside the victim's session while the page is open.

### Patterns

1. **Server session (opaque id) in an HttpOnly cookie**: simplest and revocable; store session data in a DB/Redis. Fits Next.js with server-side auth checks.
2. **Stateless signed token (JWT/JWE) in an HttpOnly cookie**: no lookup per request, but revocation is harder; keep it short-lived and keep sensitive data out.
3. **BFF pattern for SPAs**: the browser holds only an HttpOnly session cookie to your backend-for-frontend, which holds OAuth tokens server-side and calls APIs on behalf of the user. This is the current OAuth recommendation for browser apps.
4. **Access token in memory + refresh token cookie**: access token (5–15 min) in a variable, refresh token (rotated on each use, reuse detection) in an `HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh` cookie. On page load, call refresh to obtain a new access token.

### Hardening
- Short access-token lifetimes; refresh-token rotation with reuse detection.
- Revocation: deny list or session store; log out everywhere; rotate on privilege change.
- Bind sessions to context loosely (user agent changes, risk signals), not strictly to IP.
- Don't put PII or secrets in JWT payloads (they're only encoded, not encrypted, unless JWE).
- Prevent XSS (CSP, escaping) since it's the main threat to all browser-side storage.
- CSRF defences for cookie auth (SameSite, Origin checks, tokens).
- Clear storage and cookies on logout; invalidate server-side.
- Size limits: cookies are ~4 KB and sent on every request; keep them small and avoid cookies for static asset domains.

### What about `sessionStorage`?
Scoped to a tab and cleared when it closes, but equally readable by XSS. Better than `localStorage` for lifetime, no better for theft.

### Third-party contexts
Browsers restrict third-party cookies; `SameSite=None; Secure` and `Partitioned` apply to embeds. Don't design first-party auth around cross-site cookies.

## Follow-ups
- **Is a JWT in `localStorage` ever acceptable?** — For low-risk apps, short-lived tokens and strong CSP it is a risk trade-off some accept, but it leaves XSS as a full account-takeover vector.
- **Why `__Host-`?** — It prevents subdomains or insecure origins from overwriting the cookie (cookie tossing).

## Common Mistakes
- Believing `HttpOnly` prevents all XSS damage.
- Wide `Domain=.example.com` cookies exposing sessions to every subdomain.
- Long-lived, non-rotating refresh tokens.

## Tips
- Present it as "XSS exposure vs CSRF exposure" and end with the BFF or HttpOnly-cookie recommendation.
