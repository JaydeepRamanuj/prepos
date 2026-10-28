---
title: "OAuth 2.0 / OIDC for web apps: authorization code flow with PKCE, state and redirect safety"
level: advanced
type: concept
tags: [oauth, oidc, pkce, authorization-code, state, nonce, redirect-uri, bff]
related: [browser-security/cookie-flags-token-storage, browser-security/csrf-samesite, nextjs/session-cookies-stateless-vs-database]
---

## Question
Explain the OAuth 2.0 Authorization Code flow with PKCE as used by a browser app "Sign in with Google". What are `state`, `nonce` and the code verifier for, why is the implicit flow deprecated, and where should tokens live?

## Clues
- OAuth is delegated authorisation; OpenID Connect (OIDC) adds identity on top.
- A public client (SPA) cannot keep a client secret.
- Each parameter in the flow blocks a specific attack.

## Interview Answer
OAuth 2.0 lets a user grant an app limited access without sharing a password; OIDC adds an `id_token` (a signed JWT with who the user is). In the authorization code flow the app redirects the browser to the provider's `/authorize` endpoint with `client_id`, `redirect_uri`, `scope`, a random `state`, and for PKCE a `code_challenge` (the SHA-256 hash of a random `code_verifier`). After login and consent, the provider redirects back with a short-lived authorization `code` and the same `state`. The app checks `state` matches what it stored (blocking CSRF/login CSRF), then exchanges the code at the `/token` endpoint, sending the original `code_verifier`; the provider verifies it hashes to the earlier challenge, which means a stolen code is useless to anyone who didn't start the flow. For OIDC, the `nonce` ties the `id_token` to the session (replay protection) and the client validates signature, issuer, audience and expiry. PKCE replaced the implicit flow (which returned tokens in the URL fragment and was vulnerable to leakage and injection) and is now recommended for all clients, including confidential ones. I prefer doing the exchange on the server (Auth.js, a BFF) and keeping tokens out of the browser, holding only an `HttpOnly` session cookie.

## Explanation
### Roles
Resource owner (user), client (your app), authorization server (Google/Auth0/Okta), resource server (API). Public clients (SPAs, mobile) can't keep secrets; confidential clients (server-side apps) can.

### Flow

```txt
1. App creates: state=random, code_verifier=random(43–128 chars), challenge=BASE64URL(SHA256(verifier))
   Stores state + verifier (server session or sessionStorage for pure SPAs)
2. Browser → GET /authorize?response_type=code&client_id=…&redirect_uri=https://app/cb
                          &scope=openid%20email&state=XYZ&code_challenge=…&code_challenge_method=S256&nonce=N
3. User authenticates + consents at the provider
4. Provider → 302 https://app/cb?code=ABC&state=XYZ
5. App verifies state == stored; then
   POST /token  grant_type=authorization_code&code=ABC&redirect_uri=…&client_id=…&code_verifier=…
6. Provider → { access_token, id_token, refresh_token?, expires_in }
7. App validates id_token (signature via JWKS, iss, aud, exp, nonce), creates its own session
```

### What each piece prevents

| Element | Threat mitigated |
|---|---|
| `state` | CSRF on the redirect: attacker can't make your app accept a code from the attacker's own login |
| PKCE (`code_challenge`/`verifier`) | authorization code interception/injection (malicious app, browser extension, logs, referrer) |
| `nonce` | `id_token` replay |
| Exact `redirect_uri` matching | open redirect and code theft by redirecting to an attacker URL |
| Short-lived, single-use codes | limits window and replay |
| `aud`/`iss` validation | accepting tokens meant for another app or issuer |

### PKCE in code (client side)

```ts
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function createPkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}
```

In practice use a vetted library (Auth.js, `oidc-client-ts`, provider SDK) instead of hand-rolling.

### Why implicit flow was retired
It returned access tokens in the URL fragment: exposed to browser history, referrers, extensions and injected scripts, with no way to bind the token to the client that requested it and no refresh tokens. Authorization code + PKCE keeps tokens off the front channel.

### Tokens

| Token | Purpose | Notes |
|---|---|---|
| Authorization code | one-time exchange credential | short-lived (≈1 min), single use |
| Access token | call APIs (`Authorization: Bearer`) | short-lived; scope-limited; may be opaque or JWT |
| ID token | proves who logged in (OIDC) | for the client only; **don't** send it as an API credential |
| Refresh token | get new access tokens | long-lived; rotate and detect reuse; protect strongly |

### Where tokens live (recommendation)
- **Server-side app / Next.js / BFF**: the server performs the code exchange with a client secret, stores tokens server-side, and gives the browser an `HttpOnly; Secure; SameSite` session cookie. This is the current best practice for browser-based apps.
- **Pure SPA**: authorization code + PKCE; keep the access token in memory, refresh tokens rotated (or use silent re-auth), and accept the XSS exposure; avoid `localStorage` for refresh tokens.

### Common implementation vulnerabilities
- Not validating `state` or reusing a constant value.
- Wildcard or loose `redirect_uri` patterns; open redirectors on the app.
- Accepting an `id_token` without checking signature, `aud`, `iss`, `exp`, `nonce`.
- Using an `id_token` as an access token.
- Leaking tokens via URLs, logs, Referer, or analytics.
- Requesting excessive scopes; not handling revoked consent.
- Skipping account-linking checks (email unverified), enabling account takeover when merging accounts by email.
- Post-login redirect parameters (`?next=`) that allow open redirects: allowlist relative paths only.

### Next.js / Auth.js sketch
```ts
// auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },       // or database sessions
});
```
Auth.js handles `state`, PKCE, nonce, callback validation and cookie flags; you still decide session lifetimes, authorisation checks in the data layer and sign-out behaviour.

### Logout and sessions
Clear your own session, optionally call the provider's `end_session_endpoint` (RP-initiated logout) and revoke refresh tokens; validate `post_logout_redirect_uri`.

## Follow-ups
- **OAuth vs OIDC?** — OAuth authorises access to resources; OIDC standardises authentication and user info on top via the `openid` scope and ID token.
- **Why the exact-match rule for redirect URIs?** — Partial matching enables attackers to redirect the code to a controlled path on the same domain or a subdomain.

## Common Mistakes
- Implementing OAuth by hand without PKCE or state.
- Treating the access token as proof of identity.
- Storing refresh tokens in `localStorage`.

## Tips
- Walk through the seven steps and attach a threat to each parameter.
