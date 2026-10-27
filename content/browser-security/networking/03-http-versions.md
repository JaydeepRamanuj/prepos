---
title: "HTTP/1.1 vs HTTP/2 vs HTTP/3: multiplexing, head-of-line blocking and what changes for frontend"
level: hard
type: concept
tags: [http2, http3, quic, multiplexing, head-of-line-blocking, tls, performance]
related: [browser-security/http-caching, performance/http-caching-static-assets, browser-security/what-happens-when-you-type-a-url]
---

## Question
Compare HTTP/1.1, HTTP/2 and HTTP/3. What problems did each version solve, and how do they change frontend performance practices such as bundling, domain sharding and preloading?

## Clues
- Think about how many requests can share one connection and what happens when a packet is lost.
- HTTP/3 is not just "HTTP/2 over UDP"; the transport layer changed.

## Interview Answer
HTTP/1.1 sends one request at a time per connection (pipelining never worked in practice), so browsers open about six parallel connections per host, and the old workarounds were bundling, spriting and domain sharding. HTTP/2 keeps the same semantics but uses a binary framing layer to **multiplex** many request/response streams over one TCP connection, adds header compression (HPACK) and stream prioritisation, which makes many small files cheap and sharding counterproductive. But it still runs on TCP, so one lost packet stalls *all* streams until retransmission (TCP head-of-line blocking). HTTP/3 runs over **QUIC** (on UDP), which has independent streams so loss on one stream does not block others, includes TLS 1.3 in the handshake for faster connection setup (1-RTT, 0-RTT on resumption), and supports connection migration across networks (Wi-Fi to cellular) using connection ids. For frontend, I still ship fewer, well-split chunks and use compression and caching, but I no longer obsess over concatenating everything or sharding hosts.

## Explanation
### Timeline of problems and fixes

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | TCP (+TLS) | TCP + TLS | QUIC over UDP (TLS 1.3 built in) |
| Concurrency | ~6 connections/host, 1 request each | many streams on one connection | many independent streams on one connection |
| Head-of-line blocking | at HTTP level (per connection) | solved at HTTP level, still at TCP level | removed per stream |
| Headers | verbose text, repeated | HPACK compression | QPACK compression |
| Server push | no | yes (now effectively removed from browsers) | not used |
| Setup | TCP handshake + TLS handshake (2–3 RTT) | same | 1 RTT (0-RTT resumption) |
| Mobile network changes | connection breaks | connection breaks | connection migration |

### Multiplexing
```txt
HTTP/1.1:  conn1: [A....][D....]   conn2: [B..][E..]   conn3: [C.......]      (queued, limited)
HTTP/2:    one connection: A1 B1 C1 A2 B2 C2 … interleaved frames
```
A big, slow response no longer blocks small ones at the HTTP layer, but a lost TCP segment blocks every stream behind it. On lossy mobile networks HTTP/2 can be slower than HTTP/1.1 with several connections; HTTP/3 fixes this.

### Frontend implications
- **Bundling:** with HTTP/2+ many small files are fine, but not free (per-request overhead, poorer compression, and ES module waterfalls). Keep route-based code splitting with sensible chunk sizes rather than hundreds of tiny modules.
- **Domain sharding:** remove it; extra hosts mean extra DNS/TLS setups and break prioritisation.
- **Spriting/inlining:** mostly unnecessary except for tiny critical assets.
- **Preload/preconnect:** `<link rel="preconnect">` to important third-party origins saves handshakes; `rel="preload"` for late-discovered critical resources; `103 Early Hints` lets the server hint before the final response.
- **Server push:** deprecated and removed from Chrome; use preload/Early Hints instead.
- **Compression:** gzip/brotli for text; HPACK/QPACK compress headers, so large cookies still cost bytes on every request.
- **Prioritisation:** browsers set priorities (fetchpriority attribute helps for LCP images); HTTP/2 and HTTP/3 honour them via priority signals.
- **Connection coalescing:** HTTP/2 can reuse one connection for several hostnames sharing a certificate and IP.

### Discovery and deployment
Servers advertise HTTP/3 with the `Alt-Svc: h3=":443"` header (or HTTPS DNS records); the first visit typically uses HTTP/2 and later requests upgrade. Browsers fall back to TCP if UDP is blocked. CDNs like Vercel, Cloudflare and Fastly enable HTTP/3 by default; you rarely configure it yourself.

### What did not change
HTTP semantics (methods, status codes, headers, caching) are the same across versions, so `Cache-Control`, CORS and cookies behave identically. DevTools Network tab can show the protocol column (`h2`, `h3`).

### Pitfalls
- Assuming more requests are free: each still has scheduling, memory and cache cost.
- Huge single bundles still hurt parse and execution time regardless of protocol.
- Misconfigured proxies that downgrade to HTTP/1.1.
- UDP blocked on corporate networks (fallback handles it, but with extra delay).

## Follow-ups
- **What is 0-RTT and its risk?** — Resumed sessions can send data in the first flight, but 0-RTT data is replayable, so servers should only accept it for idempotent requests.
- **Why UDP for HTTP/3?** — QUIC implements reliability, ordering per stream and congestion control in user space, avoiding kernel TCP ossification and enabling faster iteration.

## Common Mistakes
- Saying HTTP/2 removed all head-of-line blocking.
- Still sharding domains.
- Believing server push is a recommended optimisation today.

## Tips
- Frame the story as "each version removed the previous bottleneck", ending at TCP.
