---
title: "Find the memory leak in this live price widget"
level: hard
type: debugging
tags: [memory-leak, websocket, cleanup, heap-snapshot, detached-dom]
related: [debugging/event-listener-fires-twice, debugging/chrome-devtools-beyond-console-log, debugging/stale-closure-interval]
---

## Question
A dashboard shows live prices. After users switch between tabs for 20 minutes, the page uses 1.5 GB of memory and becomes sluggish. Find the leaks and explain how you would confirm them.

```tsx
const priceSocket = new WebSocket("wss://example.com/prices");
const cache: Record<string, number[]> = {};

function PriceTicker({ symbol }: { symbol: string }) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    priceSocket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.symbol !== symbol) return;
      (cache[symbol] ??= []).push(msg.price);
      setPrice(msg.price);
    });

    setInterval(() => {
      priceSocket.send(JSON.stringify({ type: "ping" }));
    }, 5000);
  }, [symbol]);

  return <span>{price ?? "…"}</span>;
}
```

## Clues
- What happens to the `message` listener and the interval when the component unmounts or `symbol` changes?
- A listener keeps alive everything its closure references. What does this closure reference?
- Is there any data structure that only ever grows?

## Interview Answer
There are three leaks. The `message` listener is never removed, so every mount and every `symbol` change adds another one to a module-level socket that lives forever — each one keeps its closure, including that instance's `setPrice`, alive, and they all keep calling `setState` on unmounted components. The interval is never cleared either, so pings multiply. And `cache` is an unbounded module-level object that grows with every message. The fix is to return a cleanup that removes the listener and clears the interval, and to cap the cache — keep only the last N prices, or move it into state. I'd confirm with the Memory panel: take a heap snapshot, switch tabs ten times, take another, compare, and look at what retains the new objects and how big `cache` has become.

## Explanation
### Why each one leaks
In JavaScript, memory is freed only when nothing reachable references it. A long-lived object (a module-level socket, `window`, a global store) that holds a callback keeps that callback's whole closure reachable.

```txt
priceSocket (module-level, never GC'd)
  └─ listeners: [fn#1, fn#2, fn#3, … fn#400]
        └─ closure: { symbol, setPrice → fiber of an unmounted PriceTicker → its props, state, DOM refs }
setInterval timers: [t#1 … t#400] each sending a ping every 5s
cache: { BTC: [ … 1,200,000 numbers … ] }
```

### The fix

```tsx
const MAX_POINTS = 500;

function PriceTicker({ symbol }: { symbol: string }) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = JSON.parse(event.data);
      if (msg.symbol !== symbol) return;

      const points = (cache[symbol] ??= []);
      points.push(msg.price);
      if (points.length > MAX_POINTS) points.splice(0, points.length - MAX_POINTS); // bounded

      setPrice(msg.price);
    }

    priceSocket.addEventListener("message", onMessage);
    const pingId = setInterval(() => {
      if (priceSocket.readyState === WebSocket.OPEN) {
        priceSocket.send(JSON.stringify({ type: "ping" }));
      }
    }, 5000);

    return () => {
      priceSocket.removeEventListener("message", onMessage);
      clearInterval(pingId);
    };
  }, [symbol]);

  return <span>{price ?? "…"}</span>;
}
```

Better design: the ping belongs to the socket, not to each ticker. Create one connection manager that pings once and exposes `subscribe(symbol, cb) → unsubscribe`, then consume it with `useSyncExternalStore` or an effect that returns `unsubscribe`.

### Confirming it in DevTools
1. **Performance monitor** (Command Menu → "Show Performance monitor"): watch *JS heap size*, *DOM nodes* and *JS event listeners* climb while you switch tabs.
2. **Memory → Heap snapshot**: snapshot, repeat the action 10 times, force GC (trash icon), snapshot again, use **Comparison** view. Sort by *# Delta* / *Size Delta*. Many new `PriceTicker`-related closures or `Detached` elements confirm it; the **Retainers** pane shows the chain up to `priceSocket`.
3. **Console**: `getEventListeners(window)` (a DevTools console utility) lists listeners on DOM targets; for the socket, a temporary counter in add/remove is the quickest check.
4. **Allocation timeline** shows when allocations happen and which survive.

### Common leak sources in frontend apps
| Source | Fix |
|---|---|
| `addEventListener` on window/document/socket | `removeEventListener` in cleanup or `AbortController` |
| `setInterval` / `setTimeout` | `clearInterval` / `clearTimeout` in cleanup |
| Subscriptions (store, observable, `ResizeObserver`) | Call the returned unsubscribe / `disconnect()` |
| Module-level caches / arrays | Bound them (LRU, max length) or use `WeakMap` keyed by objects |
| Detached DOM held in a variable | Null the reference; avoid storing nodes in globals |

## Follow-ups
- **Does React warn about setState on unmounted components?** — Not anymore; React 18 removed that warning because it was mostly false positives. You need to find leaks with the Memory panel.
- **When does a `WeakMap` help?** — When the key is an object whose lifetime you don't control; the entry disappears when the key is garbage collected. It doesn't help with string keys like `symbol`.
- **Leak vs. high memory?** — A leak grows with repeated actions and doesn't come back down after GC; high but stable memory is a sizing problem, not a leak.

## Common Mistakes
- Removing the listener with a different function reference.
- Assuming unmounting a component frees everything it registered.
- Taking only one heap snapshot, or comparing without forcing GC first.

## Tips
- Name the shape of every leak: "a long-lived thing holding a reference to a short-lived thing".
- Walk through the snapshot-compare workflow; it is the part most candidates can't describe.
