---
title: "Can closures cause memory leaks? How do you find and fix them?"
level: hard
type: concept
tags: [closures, memory-leaks, garbage-collection, event-listeners, devtools]
related: [javascript/closure, javascript/map-set-weakmap-weakset, react/use-effect-cleanup]
---

## Question
How can closures cause memory leaks in a frontend app? Give typical leak sources and explain how you would detect and fix one.

## Clues
- Garbage collection frees what is unreachable from roots such as `window`, the DOM and active timers.
- A closure keeps its captured scope alive as long as the closure itself is reachable.
- Long-lived registries (listeners, timers, caches) are the usual roots.

## Interview Answer
Closures themselves are not leaks, but a closure keeps alive everything in its scope that it references, and if the closure stays reachable from a long-lived place, such as an event listener on `window`, an uncleared `setInterval`, a module-level cache or a subscription, the captured data can never be collected. Typical leaks are listeners and timers never removed on unmount, subscriptions without unsubscribe, caches that only grow, and detached DOM nodes held by closures. I find them with the Memory panel in DevTools: take heap snapshots before and after repeating an action, compare, and look at retained size and the retainer path of growing objects. The fix is cleanup: `removeEventListener`, `clearInterval`, `AbortController`, effect cleanups, bounded caches, and `WeakMap` or `WeakRef` for object-keyed data.

## Explanation
### Typical leaks

```js
// 1. Listener never removed; closure holds bigData
function setup() {
  const bigData = new Array(1e6).fill("x");
  window.addEventListener("resize", () => console.log(bigData.length));
}
// calling setup() repeatedly adds more listeners, each retaining its own array

// 2. Interval that runs forever
const id = setInterval(() => poll(widgetEl), 1000);
// widgetEl removed from DOM but still retained by the callback

// 3. Cache without bound
const cache = new Map();
function lookup(obj) { cache.set(obj, compute(obj)); }   // objects never freed
```

### React version

```tsx
useEffect(() => {
  const onResize = () => setWidth(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);   // cleanup
}, []);
```

Missing cleanup retains the component's closures (and its state) after unmount.

### Fixing patterns

| Source | Fix |
|---|---|
| Event listeners | `removeEventListener`, or `{ signal }` from an `AbortController` |
| Timers | `clearTimeout` / `clearInterval` |
| Subscriptions (sockets, observers) | call unsubscribe / `disconnect` |
| Growing caches | LRU limit, TTL, or `WeakMap` |
| Detached DOM nodes | drop references on removal |

```js
const ac = new AbortController();
window.addEventListener("scroll", onScroll, { signal: ac.signal });
// later:
ac.abort();   // removes every listener registered with this signal
```

### Finding leaks in Chrome DevTools
1. Memory tab → take a heap snapshot.
2. Perform the suspect action several times (open/close a modal), force GC.
3. Take another snapshot; use "Comparison" or filter "Detached" for DOM nodes.
4. Inspect "Retainers" of a growing object to see which closure or listener keeps it alive.
5. The Performance monitor shows JS heap size trending up over time.

### Not every growth is a leak
Caches and legitimate state grow by design; a leak is memory that should have been released but is still reachable.

### Engines and closures
V8 only keeps variables that inner functions actually reference, but a single `eval` or a shared context between several closures can keep more alive than expected.

## Follow-ups
- **Does `WeakRef` solve it?** — It allows collection of the target, but behaviour is nondeterministic, so use it for caches only.
- **Are circular references a problem?** — No; modern GC is mark-and-sweep and collects unreachable cycles.

## Common Mistakes
- Blaming closures instead of the long-lived reference holding them.
- Using an anonymous function in `addEventListener`, then being unable to remove it.

## Tips
- Name the three usual suspects (listeners, timers, caches) and the heap-snapshot workflow.
