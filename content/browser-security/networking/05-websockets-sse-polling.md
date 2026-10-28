---
title: "Real-time updates: polling vs SSE vs WebSockets, and handling reconnects"
level: hard
type: design
tags: [websockets, sse, polling, real-time, reconnect, heartbeat, backoff, scaling]
related: [browser-security/http-versions, browser-security/rest-graphql-trpc, architecture/api-client-error-handling]
---

## Question
You need live updates in the UI (notifications, a dashboard, and a chat). Compare polling, long polling, Server-Sent Events and WebSockets. How do you choose, and how do you handle reconnection, ordering, authentication and scaling?

## Clues
- Direction of data flow matters: server → client only, or both ways?
- Mobile networks and proxies drop idle connections.
- A reconnect must not lose or duplicate events.

## Interview Answer
For infrequent updates, **short polling** (`setInterval` fetch, ideally with ETag/`304` and a pause when the tab is hidden) is simplest and cache-friendly. **Long polling** holds the request open until there is data, giving near-real-time over plain HTTP. **Server-Sent Events** (`EventSource`) is a one-way server → client stream over regular HTTP with automatic reconnection, `Last-Event-ID` resume and text-based events; ideal for notifications, feeds, progress and dashboards. **WebSockets** give a full-duplex, low-overhead connection that fits chat, multiplayer and collaborative editing, but you must implement reconnection, heartbeats, message framing and auth yourself and they need sticky or pub/sub-backed infrastructure. I default to SSE for server-push-only and WebSockets when the client also sends frequent messages. Whatever I pick, the client needs exponential backoff with jitter on reconnect, a way to resume from the last event id (or refetch state after reconnecting), idempotent message handling, and cleanup when the component unmounts.

## Explanation
### Options

| | Polling | Long polling | SSE | WebSocket |
|---|---|---|---|---|
| Direction | client pull | client pull (held) | server → client | both |
| Protocol | HTTP | HTTP | HTTP (`text/event-stream`) | `ws://`/`wss://` after HTTP upgrade |
| Latency | up to interval | low | low | lowest |
| Auto reconnect | n/a | manual | built in (`retry:`) | manual |
| Resume | n/a | manual | `Last-Event-ID` header | manual protocol |
| Proxies/CDN friendliness | excellent | good | good (needs streaming support) | sometimes blocked/limited |
| Binary data | yes | yes | no (text only) | yes |
| HTTP/2 multiplexing | yes | yes | yes (avoids the 6-connection limit) | separate connection |
| Complexity | very low | low | low | medium-high |

### SSE client

```ts
const es = new EventSource("/api/stream", { withCredentials: true });
es.addEventListener("order-updated", (e) => {
  const order = JSON.parse((e as MessageEvent).data);
  queryClient.setQueryData(["order", order.id], order);
});
es.onerror = () => { /* browser retries automatically; show a "reconnecting…" badge if readyState === CONNECTING */ };
// cleanup: es.close()
```
Server sends `id: 42`, `event: order-updated`, `data: {...}` frames separated by blank lines; on reconnect the browser sends `Last-Event-ID: 42` so the server can replay missed events. `EventSource` cannot set custom headers, so authenticate with cookies or a short-lived token in the URL (prefer cookies), or use `fetch` streaming for header control.

### Robust WebSocket client

```ts
class ReconnectingSocket {
  private ws?: WebSocket;
  private attempt = 0;
  private heartbeat?: number;
  private closedByUser = false;

  constructor(private url: string, private onMessage: (m: unknown) => void) { this.connect(); }

  private connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.attempt = 0;
      this.ws!.send(JSON.stringify({ type: "resume", lastSeq: this.lastSeq }));    // ask for missed events
      this.heartbeat = window.setInterval(() => this.ws?.send('{"type":"ping"}'), 25_000);   // keep proxies from idling out
    };
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.seq <= this.lastSeq) return;                // drop duplicates
      this.lastSeq = msg.seq;
      this.onMessage(msg);
    };
    this.ws.onclose = () => {
      clearInterval(this.heartbeat);
      if (this.closedByUser) return;
      const delay = Math.min(30_000, 500 * 2 ** this.attempt++) * (0.5 + Math.random() / 2);   // backoff + jitter
      setTimeout(() => this.connect(), delay);
    };
  }
  private lastSeq = 0;
  close() { this.closedByUser = true; this.ws?.close(); }
}
```

Browsers do not expose WebSocket ping/pong frames to JavaScript, so app-level heartbeats detect dead connections (missing pong → force reconnect).

### Correctness concerns
- **Delivery semantics:** at-least-once is realistic; include sequence numbers or ids and make handlers idempotent.
- **Resync strategy:** after reconnect either replay from `lastSeq` or refetch the authoritative state via REST and then continue the stream, avoiding gaps.
- **Ordering:** keep a per-channel sequence; buffer out-of-order messages if needed.
- **Backpressure:** batch UI updates (`requestAnimationFrame` or 100ms flush) so a burst of messages does not cause hundreds of renders.
- **Visibility:** close or pause streams when the tab is hidden for long (`visibilitychange`) and refetch on return.
- **Browser limits:** HTTP/1.1 allows ~6 connections per host, so multiple SSE streams can starve other requests; use HTTP/2 or multiplex over one stream.

### Authentication and security
- Authenticate during the handshake with cookies (check `Origin` to prevent cross-site WebSocket hijacking, since WebSockets are not covered by CORS) or a short-lived ticket obtained via REST and passed in the URL/first message.
- Re-authorise per channel/subscription on the server; expiring tokens require a refresh and reconnect strategy.
- Rate limit and validate every message; never trust client-sent payloads.
- Use `wss://` only.

### Scaling the server
Connections are long-lived and stateful: use a message broker or pub/sub (Redis, NATS, Kafka) so any node can publish to clients connected elsewhere; load balancers need WebSocket support and idle timeouts above the heartbeat interval. Serverless platforms often limit long connections, so use a managed service (Ably, Pusher, Supabase Realtime, Cloudflare Durable Objects) or an always-on runtime.

### In React

```tsx
function useLiveOrders() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/orders/stream");
    es.onmessage = (e) => qc.setQueryData(["orders"], (old: Order[] = []) => upsert(old, JSON.parse(e.data)));
    return () => es.close();                         // always close on unmount
  }, [qc]);
}
```
Combine with TanStack Query: the stream patches the cache, the initial load and reconnect refetch use normal queries.

### Choosing
- Notifications, live dashboards, build logs, AI token streaming → SSE.
- Chat, presence, collaborative cursors, games → WebSockets.
- Updates every 30–60 seconds, simple infrastructure → polling with `refetchInterval`.
- Spiky traffic on serverless → polling or a managed realtime provider.

## Follow-ups
- **Can SSE and WebSockets work behind a CDN?** — SSE needs response streaming and no buffering; WebSocket needs upgrade support. Check proxy buffering and idle timeouts.
- **How do you stream LLM output?** — SSE or `fetch` with a `ReadableStream`, appending tokens to state.

## Common Mistakes
- No backoff, causing reconnect storms after an outage.
- Forgetting to close connections on unmount.
- Assuming messages arrive exactly once and in order across reconnects.

## Tips
- Mention resume (`Last-Event-ID`/sequence numbers) and backoff with jitter; those separate demos from production designs.
