---
title: "XSS and Content Security Policy: types of XSS, prevention and a practical CSP"
level: hard
type: concept
tags: [xss, csp, sanitization, trusted-types, nonce, dangerouslySetInnerHTML, security-headers]
related: [browser-security/cookie-flags-token-storage, browser-security/csrf-samesite, browser-security/supply-chain-security]
---

## Question
What is XSS, what are its types, and how do you prevent it in a React/Next.js app? Explain what a Content Security Policy does, how nonces work, and why CSP is defence in depth rather than a fix.

## Clues
- XSS means attacker-controlled data is interpreted as code in your origin.
- React escapes by default, but there are escape hatches.
- CSP limits what injected script can do or load.

## Interview Answer
XSS happens when untrusted data ends up executed as script in the page's origin, giving the attacker everything the user has there: reading the DOM and non-HttpOnly storage, calling APIs with the user's cookies, and rewriting the UI. The types are **stored** (saved in the database, e.g. a comment), **reflected** (echoed from the URL or form in the response) and **DOM-based** (client code writes untrusted data into a dangerous sink like `innerHTML`, `document.write` or `eval`). Prevention is primarily output encoding in the right context: React escapes text and attribute values by default, so the risks are `dangerouslySetInnerHTML`, unvalidated `href`/`src` values (`javascript:` URLs), `eval`-like APIs, server-side templates that skip escaping, and third-party scripts. When HTML must be rendered (rich text, markdown) I sanitise it with an allowlist sanitizer such as DOMPurify, ideally on the server. Then I add **Content Security Policy** as a second layer: a response header that restricts script sources, ideally with per-request nonces and `strict-dynamic`, so injected inline scripts don't run, plus `object-src 'none'` and `base-uri 'none'`. CSP reduces blast radius but doesn't replace correct escaping.

## Explanation
### Types

| Type | Where the payload lives | Example |
|---|---|---|
| Stored | database / persisted content | comment containing `<img src=x onerror=...>` |
| Reflected | request → immediate response | `/search?q=<script>…` echoed unescaped |
| DOM-based | client-side code reads `location`, `postMessage`, storage and writes to a sink | `el.innerHTML = location.hash.slice(1)` |

### Dangerous sinks in React/Next.js
```tsx
<div dangerouslySetInnerHTML={{ __html: userHtml }} />   // sanitise first
<a href={userUrl}>link</a>                                // validate protocol: allow only http/https/mailto
<iframe src={userUrl} />                                  // same, plus sandbox
el.innerHTML = value;                                     // use textContent
eval(code); new Function(code); setTimeout("code", 0);    // never with user data
<script>{`window.__DATA__ = ${JSON.stringify(data)}`}</script>   // escape "<" as < to avoid </script> breakouts
```
React does not block `javascript:` URLs in `href` (it warns in dev), so validate with `new URL(value, base).protocol`.

### Sanitising HTML
```ts
import DOMPurify from "isomorphic-dompurify";
const clean = DOMPurify.sanitize(userHtml, { USE_PROFILES: { html: true } });
```
Allowlist tags/attributes, strip event handlers and dangerous URLs. For markdown, render with a safe pipeline (remark/rehype with `rehype-sanitize`) and avoid raw HTML passthrough for untrusted input. Note that in this repository content is authored in-repo and trusted; user-generated content never is.

### Content Security Policy
A header (`Content-Security-Policy`) that tells the browser which sources are allowed for each resource type.

```txt
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{RANDOM}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  form-action 'self';
  upgrade-insecure-requests
```

- **Nonce:** a random, unguessable value generated per request, included in the header and on every legitimate `<script nonce="…">`. Injected scripts lack the nonce and are blocked. `strict-dynamic` lets nonce-approved scripts load further scripts without listing hosts, which fits bundlers and tag managers.
- **Hash-based:** `'sha256-…'` for static inline scripts.
- Avoid `'unsafe-inline'` and `'unsafe-eval'` for scripts; allowlists of hosts are easy to bypass (JSONP, open redirects on allowed CDNs).
- **`frame-ancestors`** prevents clickjacking (modern replacement for `X-Frame-Options`).
- **`Content-Security-Policy-Report-Only`** plus `report-to` lets you roll out safely: observe violations before enforcing.

In Next.js, generate the nonce per request in `proxy.ts`, set the CSP header and pass the nonce via a request header so the framework applies it to its scripts. Nonce-based CSP requires dynamic rendering (static pages cannot embed a per-request nonce), which is a real trade-off. See the Next.js CSP question for the exact steps and the bundled docs.

### Trusted Types
`Content-Security-Policy: require-trusted-types-for 'script'` makes dangerous DOM sinks accept only values produced by a sanctioned policy (for example DOMPurify), turning DOM XSS into a compile-time-like discipline. Support is Chromium-first; use it where available.

### Other defences
- `HttpOnly` cookies so injected script cannot read session cookies (it can still *use* the session via same-origin requests).
- Avoid storing tokens in `localStorage`.
- `X-Content-Type-Options: nosniff`, correct `Content-Type` for user uploads, serve uploads from a separate origin.
- Subresource Integrity for third-party scripts; minimise third-party code.
- Escape on output for the right context (HTML body, attribute, URL, JS, CSS); framework autoescaping covers only some.

### Testing
Try payloads like `"><img src=x onerror=alert(1)>`, check every place user data renders, run automated scanners (ZAP), add ESLint rules (`react/no-danger`) where lint is used, and review each `dangerouslySetInnerHTML` in code review.

## Follow-ups
- **Does React make XSS impossible?** — No: escape hatches, `href` protocols, server-rendered strings, markdown/HTML rendering, and third-party scripts remain.
- **Why is `localStorage` token storage risky?** — Any XSS can read and exfiltrate it, whereas an HttpOnly cookie cannot be read by script.

## Common Mistakes
- Sanitising on input instead of encoding on output.
- Relying on CSP while leaving injection bugs.
- Allowlisting broad CDNs in `script-src`.

## Tips
- Say "encode by context, sanitise rich HTML with an allowlist, CSP with nonces as backup".
