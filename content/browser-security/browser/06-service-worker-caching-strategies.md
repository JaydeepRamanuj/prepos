---
title: "How do service workers work, and which caching strategy would you use for each resource?"
level: advanced
type: design
tags: [service-worker, pwa, cache-api, offline, caching-strategies]
related: [browser-security/http-caching, browser-security/browser-storage-options, performance/http-caching-static-assets]
---

## Question
Your team wants the app to load instantly on repeat visits and show something useful offline. Explain the service worker lifecycle, then pick a caching strategy for: the app shell (HTML), hashed JS/CSS bundles, user avatar images, and the `/api/feed` JSON. Write the service worker code for at least one strategy.

## Clues
- A service worker is a proxy that sits between the page and the network. Which event lets it answer requests?
- There are five classic strategies: cache only, network only, cache first, network first, stale-while-revalidate. Match each to how fresh the resource must be.
- Think about what happens when you deploy a new version: how do old caches get deleted, and when does the new worker take over?

## Interview Answer
A service worker is a script the browser runs in the background, separate from the page, that can intercept every network request from pages in its scope through the `fetch` event and answer from the Cache API, the network, or both. It goes through install, where I pre-cache the app shell; waiting, while old tabs still use the previous version; and activate, where I delete old caches. For hashed bundles I use cache first, because a new deploy produces new URLs. For the HTML shell I use network first with a cached fallback, so users get fresh deploys online and still see the app offline. Avatars suit stale-while-revalidate — fast and eventually fresh. For `/api/feed` I would use network first with a short timeout and a cached fallback, or leave it to TanStack Query, because stale personal data offline needs care. I would use Workbox rather than hand-writing all of this, and keep proper HTTP caching underneath since the service worker is an extra layer, not a replacement.

## Explanation
### What a service worker is
- A worker script: no DOM access, event-driven, can be stopped by the browser when idle.
- Controls pages within its **scope** (by default the folder it is served from — serve `/sw.js` to control the whole site).
- Requires **HTTPS** (localhost is allowed for development).
- Talks to storage through the **Cache API** and IndexedDB.

### Lifecycle

```txt
register() → install ──→ waiting ──→ activate ──→ controls pages, receives fetch
              (pre-cache)  (old SW still       (clean old caches)
                            controls open tabs)
```

- A new worker **waits** until all tabs using the old one close. `self.skipWaiting()` skips the wait; `clients.claim()` makes it control already-open pages immediately. Use both carefully: a page loaded with old HTML might now get new assets.
- The browser checks for an updated `sw.js` on navigations; serve `sw.js` itself with `Cache-Control: no-cache` so updates are seen.

### Strategies

| Strategy | Behaviour | Good for |
|---|---|---|
| Cache only | Never hits network | Pre-cached shell assets |
| Network only | Never uses cache | Analytics, payments, non-GET |
| Cache first | Cache, fall back to network | Hashed bundles, fonts |
| Network first | Network, fall back to cache | HTML, important API data |
| Stale-while-revalidate | Serve cache now, refresh in background | Avatars, non-critical API data |

### Code: register, pre-cache, clean up, and route

```js
// app code
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```

```js
// sw.js
const VERSION = "v3";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const SHELL_URLS = ["/", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()); // body can be read once → clone
    return response;
  } catch {
    return (await cache.match(request)) ?? caches.match("/offline.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(RUNTIME_CACHE)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  event.waitUntil(refresh.catch(() => {})); // keep the worker alive for the background update
  return cached ?? refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // let the browser handle it normally

  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, event));
  }
  // anything not matched falls through to the network
});
```

Key details:
- **`response.clone()`** — a response body is a stream that can be consumed once; one copy goes to the cache, one to the page.
- **`event.waitUntil`** — tells the browser not to kill the worker until the promise settles.
- **Only cache `ok` responses** — otherwise you can cache a 500 page forever.
- **Versioned cache names** — activate deletes everything that is not the current version.

### PWA basics
An installable PWA needs HTTPS and a **web app manifest** (`name`, `icons`, `start_url`, `display`); a service worker supplies the offline experience. In Next.js the App Router supports a `app/manifest.ts` file for the manifest.

### Trade-offs
- A buggy service worker can serve a broken app until it updates. Keep a "kill switch" plan: deploy a worker that unregisters itself or clears caches.
- Caching personalised API data means a different user on the same device might see it — clear caches on logout.
- Do not cache what the HTTP cache already handles well; the service worker shines for offline and for navigations.

## Follow-ups
- **How do you tell the user a new version is available?** — Listen for `updatefound` / a worker reaching `installed` while one is already controlling the page, show a "Refresh to update" toast, and on click post a message that calls `skipWaiting()`, then reload on `controllerchange`.
- **Service worker vs HTTP cache — which wins?** — The service worker sees the request first; its own `fetch()` calls still go through the HTTP cache.
- **Why not just use Workbox?** — You should in production; it handles routing, expiration and precache manifests. Interviewers ask for the raw code to check you understand what it does.

## Common Mistakes
- Forgetting `clone()`, which causes "body already used" errors.
- Caching HTML with cache first, so users are stuck on an old deploy.
- Never deleting old caches in `activate`, slowly filling the quota.
- Intercepting `POST` requests or third-party requests without handling opaque responses.

## Tips
- Answer by resource type in a table — it shows you are choosing a strategy based on freshness needs, not reciting definitions.
- Mention the update problem (waiting worker) unprompted; it is what separates people who have shipped a service worker from those who read about one.
