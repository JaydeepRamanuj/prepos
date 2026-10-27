---
title: "Securing an API with access tokens: validating JWTs, scopes and service-to-service auth"
level: advanced
type: design
tags: [api-security, jwt-validation, jwks, scopes, oauth, client-credentials, bff]
related: [backend/jwt-vs-sessions, browser-security/oauth-oidc-pkce, backend/authz-rbac-idor]
---

## Question
Your Next.js frontend talks to an internal API that is also used by a mobile app and other services. How does the API validate access tokens, enforce scopes, and how do services authenticate to each other? Where does the BFF fit?

## Clues
- The API should not trust the client; it trusts a signature from the authorization server.
- Scopes describe what a token may do; permissions on data still require object-level checks.
- Machines use a different grant than users.

## Interview Answer
The API acts as an OAuth **resource server**: it receives `Authorization: Bearer <access token>` and validates it locally. For JWT access tokens that means fetching the issuer's public keys from the JWKS endpoint (cached, with `kid` selection and rotation), verifying the signature and algorithm, and checking `iss`, `aud` (this API), `exp`/`nbf`, then reading `scope`/`permissions` and `sub`. For opaque tokens it calls the introspection endpoint (cacheable for a short time). Scopes gate coarse capabilities (`orders:read`, `orders:write`) at the route level, while object-level rules (this user's orders only) are still enforced in the data layer. Browser users come through authorization code + PKCE (or, better, a BFF that holds tokens server-side and gives the SPA only a session cookie); mobile apps use PKCE with the system browser; backend services use the **client credentials** grant with their own client id/secret or private-key JWT (or mTLS) and narrow scopes; when one service calls another on behalf of a user, it forwards or exchanges the token (token exchange) while preserving audience restrictions. Tokens are short-lived, audience-bound, and never logged.

## Explanation
### Validation checklist
```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL("https://auth.example.com/.well-known/jwks.json"));   // cached, rotates with kid

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: "https://auth.example.com",
    audience: "https://api.example.com",
    algorithms: ["RS256"],                       // pin; never trust the token's header alone
    clockTolerance: 5,
  });
  return payload;                                // sub, scope, exp…
}

export function requireScope(payload: { scope?: string }, needed: string) {
  if (!payload.scope?.split(" ").includes(needed)) throw new Response("Forbidden", { status: 403 });
}
```
Return `401` with `WWW-Authenticate: Bearer error="invalid_token"` for bad tokens and `403` (`insufficient_scope`) for missing scopes.

### Layers of access control

| Layer | Question | Mechanism |
|---|---|---|
| Authentication | Is the token valid and for this API? | signature, `iss`, `aud`, `exp` |
| Scope | May this client perform this kind of operation? | `scope` claim |
| Role/permission | Is this user allowed this feature? | roles/permissions from token or lookup |
| Object | May they touch this record? | ownership/tenant check in the query |

Scopes are granted to the **client app** on behalf of the user; they don't replace per-user authorization.

### Grants by client type

| Client | Grant | Notes |
|---|---|---|
| Browser (server-rendered / BFF) | authorization code (+ PKCE); confidential client secret on the server | tokens stay server-side |
| SPA without BFF | authorization code + PKCE | token in memory; XSS exposure |
| Mobile / desktop | authorization code + PKCE via system browser | never embedded webviews |
| Service-to-service | client credentials | no user; narrow scopes; rotate secrets, prefer private-key JWT/mTLS |
| Device (TV, CLI) | device authorization grant | user approves on another device |

### BFF pattern
```txt
Browser ── session cookie (HttpOnly) ──► Next.js server (BFF)
                                           │ holds access/refresh tokens
                                           ▼ Bearer access token
                                         Internal API (resource server)
```
The browser never sees tokens, so XSS can't steal them; the BFF refreshes tokens, attaches them, and can aggregate calls. CSRF defences apply to the cookie boundary.

### Service-to-service
- Client credentials grant, audience per target API, minimal scopes, short lifetimes, cached until near expiry.
- Mutual TLS or workload identity (SPIFFE, cloud IAM) inside the network.
- Propagate user context (`sub`) via signed token exchange (RFC 8693), not by trusting a plain header like `X-User-Id` set by callers.
- Gateway terminates auth for simple cases, but services still verify tokens (zero trust).

### Operations
- Cache JWKS and handle key rotation (refetch on unknown `kid`, rate-limited).
- Clock skew tolerance; NTP.
- Revocation: rely on short TTLs; for opaque tokens introspection supports instant revocation.
- Never log tokens; redact `Authorization` headers.
- Rate-limit per client id; audit token issuance and failures.
- Separate access tokens (for APIs) from ID tokens (for the client): APIs must reject ID tokens.
- Use `aud` per API to prevent a token for one API being replayed to another ("confused deputy").

## Follow-ups
- **JWT vs opaque access tokens?** — JWT validates locally and fast but can't be revoked easily; opaque needs introspection but is revocable and leaks no claims.
- **How do you rotate signing keys without downtime?** — Publish the new key in JWKS first, start signing with it, keep the old key until old tokens expire.

## Common Mistakes
- Accepting any validly-signed token regardless of `aud`.
- Treating scopes as complete authorization.
- Using the ID token to call APIs.

## Tips
- Draw the BFF diagram and list the claims you validate.
