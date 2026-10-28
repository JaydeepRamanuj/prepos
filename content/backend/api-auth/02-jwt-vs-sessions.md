---
title: "JWT vs server sessions: trade-offs, revocation and when to use each"
level: hard
type: concept
tags: [jwt, sessions, authentication, revocation, refresh-tokens, stateless, cookies]
related: [browser-security/cookie-flags-token-storage, nextjs/session-cookies-stateless-vs-database, backend/oauth-oidc-backend]
---

## Question
Compare server-side sessions with JWT-based authentication. Cover scalability, revocation, token contents, storage, expiry and refresh, and say which you would choose for a typical Next.js SaaS app.

## Clues
- "Stateless" means the server does not look anything up per request, which is exactly why revocation is hard.
- A JWT is signed (integrity), not encrypted (confidentiality), unless it is a JWE.
- Where the credential is stored matters as much as its format.

## Interview Answer
A server session stores state (user id, roles, expiry) on the server in a database or Redis and gives the browser an opaque random id in an `HttpOnly` cookie; each request looks the session up. A JWT is a signed token containing claims (`sub`, `exp`, roles) that any service with the key can verify without a lookup. Sessions are simple, instantly revocable (delete the row), small on the wire, and can change permissions immediately; the cost is a store lookup and shared storage across instances. JWTs scale horizontally with no shared store and suit service-to-service and multi-API setups, but they cannot be revoked before expiry without adding state (deny-lists, short expiry plus refresh tokens, token versioning), they grow in size, and stale claims persist until expiry. For a typical first-party Next.js SaaS app I choose server sessions (or a short-lived signed session cookie plus a database check for sensitive actions) in an `HttpOnly; Secure; SameSite` cookie, and use JWT access tokens when other services or third parties need verifiable tokens, keeping them short-lived (5–15 minutes) with rotated refresh tokens.

## Explanation
### Anatomy of a JWT
`base64url(header).base64url(payload).signature`

```json
{ "alg": "RS256", "typ": "JWT" }
{ "sub": "user_42", "iss": "https://auth.example.com", "aud": "api", "exp": 1767225600, "iat": 1767224700, "role": "admin" }
```
Anyone can decode the payload; never put secrets in it. Verify the signature, `alg` (pin it; reject `none`), `iss`, `aud` and `exp`. HS256 uses a shared secret; RS256/ES256 use a private key to sign and a public key (via JWKS) to verify, which lets many services verify without holding signing power.

### Comparison

| | Server session | JWT |
|---|---|---|
| State | on the server (DB/Redis) | in the token |
| Per-request cost | store lookup | signature verification (CPU only) |
| Revocation / logout everywhere | immediate | hard; needs deny-list or short TTL |
| Permission changes | take effect at once | after expiry or refresh |
| Size | tiny cookie | grows with claims |
| Cross-service use | needs shared store or gateway | natural for microservices |
| Horizontal scale | needs shared store | stateless |
| Typical failure | session store outage | leaked token valid until expiry |

### Revocation strategies for JWTs
1. Short access-token TTL (minutes) plus refresh token stored server-side (so you can revoke refresh).
2. Deny-list of `jti` or user "token version" checked per request (this reintroduces state, often in Redis).
3. Rotate signing keys (`kid`) to invalidate all tokens in an emergency.
4. Refresh-token rotation with reuse detection: reuse of an old refresh token revokes the family.

### Storage
Whatever the format, store browser credentials in an `HttpOnly; Secure; SameSite` cookie rather than `localStorage` (see the cookie question). "JWT in a cookie" is perfectly valid; the choice of format and the choice of storage are independent.

### Session cookie flow (typical)
```ts
// login
const sessionId = crypto.randomUUID();                       // or 32+ random bytes
await redis.set(`sess:${sessionId}`, JSON.stringify({ userId, role }), "EX", 60 * 60 * 24 * 7);
cookies().set("__Host-sid", sessionId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 604800 });

// request
const data = await redis.get(`sess:${sid}`);
if (!data) return unauthorized();
```
Rotate the session id on login and privilege change (prevents session fixation), and set both idle and absolute timeouts.

### Choosing
- Monolith or Next.js app with one backend → sessions (database or Redis; Auth.js supports both strategies).
- Many services verifying identity independently, mobile clients, third-party API access → JWT access tokens from an authorization server, short-lived.
- High-security needs (banking, admin) → server sessions with step-up auth and instant revocation.
- Edge-only deployments without a store → signed/encrypted cookie sessions (e.g. `jose`) with short expiry, accepting limited revocation.

### Pitfalls
- Using JWTs just because they are popular, then rebuilding sessions around them.
- Putting PII or permissions that change often in the token.
- Not validating `aud`/`iss`, or allowing the `alg` header to choose the algorithm.
- Long-lived JWTs with no revocation path.
- Storing the token in `localStorage`.

## Follow-ups
- **Why not make JWTs expire in 30 days and be done?** — A stolen token works for 30 days, and role changes or account bans don't apply.
- **What is a "stateless session cookie"?** — A signed (or encrypted) cookie holding the session data itself; no lookup, but size-limited and hard to revoke.

## Common Mistakes
- Treating JWT as a synonym for "secure".
- Believing a signed token is secret.
- Forgetting that revocation requires state somewhere.

## Tips
- Say "revocation" within the first two sentences; it is the crux.
