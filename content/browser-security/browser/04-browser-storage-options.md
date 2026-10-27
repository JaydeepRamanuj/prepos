---
title: "Cookies vs localStorage vs sessionStorage vs IndexedDB vs Cache API — when do you use each?"
level: easy
type: concept
tags: [storage, cookies, localstorage, indexeddb, cache-api]
related: [browser-security/cookie-flags-and-token-storage, browser-security/service-worker-caching-strategies]
---

## Question
Compare the browser storage options: cookies, `localStorage`, `sessionStorage`, IndexedDB and the Cache API. Cover size limits, lifetime, whether they are sent to the server, and a good use case for each.

## Interview Answer
Cookies are small — around 4 KB each — and are the only option sent to the server automatically with every request, so I use them for sessions, ideally `HttpOnly` so JavaScript cannot read them. `localStorage` and `sessionStorage` are synchronous string key-value stores with about 5 MiB per origin; `localStorage` persists until cleared and is shared across tabs, while `sessionStorage` is scoped to one tab and cleared when it closes. I use them for small UI preferences like theme or a draft, never for secrets, because any script on the page can read them. IndexedDB is an asynchronous database for structured data and large amounts — offline data, caches of API results — and the Cache API stores request/response pairs, mainly for service workers doing offline support. Both of those share a large quota that is a percentage of disk space.

## Explanation
### Comparison

| | Cookies | localStorage | sessionStorage | IndexedDB | Cache API |
|---|---|---|---|---|---|
| Size | ~4 KB per cookie | ~5 MiB per origin | ~5 MiB per origin | Large (shared quota, % of disk) | Large (same shared quota) |
| Sent to server | Yes, every matching request | No | No | No | No |
| Lifetime | Session or `Expires`/`Max-Age` | Until cleared | Until the tab closes | Until cleared/evicted | Until cleared/evicted |
| Scope | Domain + path | Origin, all tabs | Origin + one tab | Origin | Origin |
| API | `document.cookie` / headers | Sync | Sync | Async | Async (Promises) |
| Data | Strings | Strings | Strings | Structured clone (objects, Blobs) | `Request` → `Response` |
| In workers | No `document.cookie` | No | No | Yes | Yes |

### Use cases
- **Cookies** — session IDs and auth (set by the server with `HttpOnly; Secure; SameSite`). Do not stuff app data in them: every byte rides on every request.
- **localStorage** — theme, dismissed banners, last-used filter. Small, non-sensitive, needed across tabs.
- **sessionStorage** — state for one tab's flow, such as a multi-step form you want to survive a reload but not leak into other tabs.
- **IndexedDB** — offline-first data, large lists, files/Blobs. Use a wrapper like `idb` because the raw API is event-based and verbose.
- **Cache API** — HTTP responses for offline pages and assets, usually written by a service worker.

### Things that trip people up
- **localStorage is synchronous** — big reads/writes block the main thread. Keep it small.
- **Strings only** — `localStorage.setItem("user", obj)` stores `"[object Object]"`. Use `JSON.stringify`/`JSON.parse`.
- **Quota errors** — writes past the limit throw `QuotaExceededError`; wrap them in `try/catch`.
- **Eviction** — IndexedDB and Cache data are "best-effort" by default and can be evicted under storage pressure (least recently used origin first). `navigator.storage.persist()` asks for persistent storage; `navigator.storage.estimate()` reports usage.
- **Safari** — with tracking prevention on, script-written storage for a site the user has not interacted with in seven days of browser use can be deleted.
- **SSR** — `localStorage` does not exist on the server, so reading it during render in Next.js causes errors or hydration mismatches. Read it in an effect.

## Follow-ups
- **Can another tab see a `localStorage` change?** — Yes, other same-origin tabs receive a `storage` event; the tab that wrote it does not.
- **Why not store a JWT in localStorage?** — Any XSS can read and exfiltrate it. An `HttpOnly` cookie cannot be read by scripts.
- **Does duplicating a tab copy sessionStorage?** — Yes, the new tab starts with a copy, after which the two diverge.

## Common Mistakes
- Saying `sessionStorage` is cleared on reload — it survives reloads, just not closing the tab.
- Treating `localStorage` as secure because it is "per origin" — any script running on that origin can read it.
- Forgetting cookies have a cost on every request, including image and API requests to that domain.

## Tips
- Lead with the one property that matters most: **only cookies go to the server**. Then size, then lifetime.
- Pair each option with a one-word use case: cookies → auth, local → prefs, session → tab flow, IndexedDB → offline data, Cache → offline responses.
