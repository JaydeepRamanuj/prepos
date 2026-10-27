---
title: "Stateless vs database sessions, and which cookie flags matter"
level: hard
type: concept
tags: [sessions, cookies, jwt, httpOnly, sameSite, secure, auth]
related: [nextjs/optimistic-auth-checks-proxy, nextjs/data-access-layer, browser-security/cookie-flags-token-storage]
---

## Question
Compare stateless (signed/encrypted cookie) sessions with database-backed sessions. Which cookie attributes would you set, how do you create, refresh and delete a session in Next.js, and what are the trade-offs for revocation?

## Clues
- A stateless session stores the data in the cookie itself.
- A database session stores only an id in the cookie.
- Cookie flags defend against XSS, CSRF and network sniffing.

## Interview Answer
A stateless session puts the session payload (user id, role, expiry) in a signed and ideally encrypted cookie or JWT; the server verifies it without a database lookup, which is fast and simple, but I can't easily revoke a single session before it expires. A database session stores a random session id in the cookie and the data server-side, which allows revocation, "log out of all devices" and last-seen tracking, at the cost of a lookup per request (cacheable per request with `cache()`). Either way the cookie should be `HttpOnly` so scripts can't read it, `Secure` so it only travels over HTTPS, `SameSite=Lax` (or `Strict`) to limit cross-site sends, a restrictive `Path`, and an expiry that matches the session lifetime. In Next.js I create the cookie in a Server Action or Route Handler via `cookies().set`, verify it in the DAL, refresh it by re-setting with a new expiry, and delete it on logout. I don't store sensitive data in a client-readable token, and I verify tokens in the DAL rather than trusting the proxy alone.

## Explanation
### Comparison

| | Stateless | Database |
|---|---|---|
| Cookie contains | signed/encrypted payload (JWT/JWE) | opaque random id |
| Per-request cost | CPU verify only | DB/Redis lookup |
| Revocation | hard (rotate keys, short expiry, denylist) | easy (delete row) |
| Multi-device logout | hard | easy |
| Size/leak risk | payload visible if only signed | nothing sensitive in the cookie |
| Scaling | trivially stateless | needs shared store |
| Best for | simple apps, short-lived sessions | apps needing control, audit, admin tools |

### Stateless with `jose`

```ts
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const key = new TextEncoder().encode(process.env.SESSION_SECRET);

export async function createSession(userId: string, role: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key);

  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function decrypt(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload as { userId: string; role: string };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete("session");
}
```

`cookies()` is async in current Next.js. Setting cookies is only allowed in Server Actions and Route Handlers, not while rendering a Server Component. Signing only prevents tampering; encrypt (JWE or iron-session) if the payload must be confidential.

### Database sessions

```ts
export async function createSession(userId: string) {
  const id = crypto.randomUUID();                       // or 32 random bytes, base64url
  const expiresAt = new Date(Date.now() + 7 * 864e5);
  await db.session.create({ data: { id: hash(id), userId, expiresAt } });   // store a hash
  (await cookies()).set("sid", id, { httpOnly: true, secure: true, sameSite: "lax", expires: expiresAt, path: "/" });
}
```

Look up with `cache()` in the DAL to do it once per request. Delete the row on logout; delete all rows to log out everywhere.

### Cookie flags

| Flag | Protects against | Notes |
|---|---|---|
| `HttpOnly` | token theft through XSS (JS can't read it) | doesn't stop XSS actions made with the cookie |
| `Secure` | sniffing on plain HTTP | required for `__Host-` prefix |
| `SameSite=Lax` | most CSRF (cookie not sent on cross-site POST) | `Strict` is stronger but breaks inbound links; `None` needs `Secure` |
| `Path`, `Domain` | scope | omit `Domain` for host-only cookies |
| `Max-Age`/`Expires` | lifetime | shorter for sensitive apps; sliding refresh |
| `__Host-` prefix | host-only, `Secure`, `Path=/` enforced | good default name |

### Refreshing
On a trusted activity (e.g. in the DAL or a Server Action) re-issue the cookie with a new expiry; don't rely on rendering to set cookies. Rotate session ids on privilege changes (login, role change) to prevent fixation.

### Other considerations
- Store secrets (`SESSION_SECRET`) in env vars, read only by the server module.
- Don't put the token in `localStorage` (XSS-readable).
- CSRF: `SameSite` plus Next.js' Origin check for Server Actions; add tokens for Route Handlers that accept cookies on state-changing methods.
- Rate-limit login; hash passwords with Argon2/bcrypt/scrypt.
- Prefer a maintained library (Auth.js, Better Auth, Clerk) unless you have a reason.

## Follow-ups
- **How do you revoke a stateless session?** — Short expiry plus refresh tokens, a denylist keyed by `jti`, or key rotation; or switch to database sessions.
- **Why hash the session id in the DB?** — So a database leak doesn't hand out live sessions.

## Common Mistakes
- Storing tokens in `localStorage`.
- Missing `HttpOnly`/`Secure`.
- Long-lived JWTs with no revocation path.

## Tips
- State the trade-off as "speed vs control".
