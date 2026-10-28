---
title: "What happens when you type a URL into the browser and press Enter?"
level: medium
type: concept
tags: [dns, tcp, tls, http, rendering, navigation]
related: [browser-security/rendering-pipeline, browser-security/script-async-defer-module, browser-security/http-versions, browser-security/http-caching]
---

## Question
You type `example.com/products` into the address bar and press Enter. Walk me through everything that happens until you see a usable page. Go as deep as you can on the parts a frontend engineer can influence.

## Interview Answer
First the browser decides whether the input is a URL or a search, normalises it, and upgrades it to HTTPS if the site is on the HSTS list. Before going to the network it checks its caches — a service worker can intercept the navigation, and a fresh HTTP cache entry can skip the network entirely. Otherwise it resolves the domain through DNS (browser cache, OS cache, then a recursive resolver), opens a TCP connection and does a TLS handshake — or, over HTTP/3, a single QUIC handshake over UDP that combines both. It sends the HTTP request, the server responds with HTML, and the browser starts parsing it incrementally into the DOM while a preload scanner fetches CSS, scripts and images it spots ahead. CSS builds the CSSOM and blocks rendering, classic scripts block parsing, and once DOM and CSSOM are ready the browser computes styles, does layout, paints and composites the first frame. Then JavaScript hydrates or attaches handlers and the page becomes interactive.

## Explanation
### The whole path at a glance

```txt
input → URL parse / HSTS → service worker? → HTTP cache?
      → DNS → TCP + TLS (or QUIC) → HTTP request → response
      → parse HTML → DOM ─┐
        parse CSS → CSSOM ┴→ style → layout → paint → composite → first frame
      → run JS → interactive → load event
```

### 1. Before the network
- **Search vs URL** — the omnibox decides; `example.com/products` gets a scheme added.
- **HSTS** — if the domain sent `Strict-Transport-Security` before (or is on the browser's preload list), the browser goes straight to `https://` without an insecure first request.
- **Service worker** — if one controls this scope, its `fetch` handler sees the navigation first and can answer from the Cache API (this is how offline pages work).
- **HTTP cache** — a fresh cached response is used with zero network. HTML is usually `no-cache`, so the browser revalidates instead.

### 2. Connection
- **DNS**: browser DNS cache → OS cache (and hosts file) → recursive resolver → root → TLD → authoritative server. Result: an IP address.
- **TCP**: three-way handshake (SYN, SYN-ACK, ACK) — one round trip.
- **TLS 1.3**: one more round trip to agree keys and verify the certificate.
- **HTTP/3**: QUIC runs over UDP and folds transport + TLS into one handshake, so a new connection costs one round trip instead of two.

You can influence this: `<link rel="preconnect" href="https://cdn.example.com">` warms DNS + TCP + TLS for third-party origins you know you will need.

### 3. Request and response
The browser sends `GET /products` with cookies for that site, `Accept`, `User-Agent` and so on. The server (or CDN edge) returns HTML — ideally streamed, so the browser can start before the whole document arrives. A `301`/`302` redirect means the whole connection dance may repeat for a new host, which is why redirect chains hurt.

### 4. Parsing
- The HTML parser builds the **DOM** incrementally.
- A **preload scanner** reads ahead and starts downloading `<link rel=stylesheet>`, `<script src>`, `<img>` early.
- **CSS is render-blocking**: the browser will not paint until the CSSOM for the stylesheets in `<head>` is built, to avoid a flash of unstyled content.
- **Classic `<script>` is parser-blocking**: parsing stops until it downloads and runs, because the script could call `document.write`. `defer`, `async` and `type="module"` avoid this.

### 5. Rendering
DOM + CSSOM → computed styles → **layout** (geometry) → **paint** (draw commands) → **composite** (layers on the GPU) → first pixels. `DOMContentLoaded` fires after the HTML is parsed and deferred scripts have run; `load` fires after images and other subresources finish.

### 6. Interactive
Your JavaScript bundles run, React hydrates server-rendered HTML, and event handlers start working. Long tasks here are what make a page look ready but feel frozen.

## Follow-ups
- **What does DNS prefetch vs preconnect do?** — `dns-prefetch` only resolves the name; `preconnect` also opens TCP and TLS. Use preconnect for the 1–3 origins you will definitely hit.
- **Why is CSS render-blocking but not parser-blocking?** — Painting before CSS arrives would flash unstyled content, but the parser can keep building the DOM. A script after a stylesheet does wait for it, because the script might read styles.
- **Where does a CDN fit?** — DNS returns an edge IP close to the user, so TCP/TLS round trips are short and cached HTML/assets come from the edge.

## Common Mistakes
- Listing only "DNS, then the server sends HTML" — interviewers want the rendering half too.
- Saying the browser downloads everything and then renders; parsing and fetching are incremental and parallel.
- Forgetting caches and service workers, which can skip the network entirely.
- Saying HTTPS adds a fixed "three handshakes"; with TLS 1.3 it is one extra round trip, and HTTP/3 merges it with transport.

## Tips
- Structure your answer in the six stages above and say "I can go deeper on any of these" — let the interviewer pick.
- Tie each stage to something you control: HSTS, preconnect, CDN, streaming HTML, `defer`, critical CSS. That turns a trivia answer into a performance answer.
