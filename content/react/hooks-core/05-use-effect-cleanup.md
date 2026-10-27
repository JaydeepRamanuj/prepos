---
title: "Find the leak: an effect without proper cleanup"
level: hard
type: debugging
tags: [useEffect, cleanup, memory-leak, event-listeners]
related: [react/use-effect-when-it-runs, react/strict-mode-double-invoke, react/use-event-listener]
---

## Question
This component shows the window width and polls a status endpoint. Users report the app gets slower the longer they navigate between pages, and the console shows "Can't perform a React state update…"-style warnings in older builds. Find every bug and fix it.

```tsx
function StatusBar({ serviceId }: { serviceId: string }) {
  const [width, setWidth] = useState(window.innerWidth);
  const [status, setStatus] = useState("unknown");

  useEffect(() => {
    window.addEventListener("resize", () => setWidth(window.innerWidth));
  }, []);

  useEffect(() => {
    setInterval(async () => {
      const res = await fetch(`/api/status/${serviceId}`);
      setStatus((await res.json()).status);
    }, 5000);
  }, [serviceId]);

  return <p>{width}px — {status}</p>;
}
```

## Clues
- Every effect that *starts* something needs to *stop* it. What do these effects start?
- `removeEventListener` needs the exact same function reference that was added.
- When `serviceId` changes, how many intervals are running? And what about a fetch that resolves after unmount?

## Interview Answer
Neither effect cleans up. The resize listener is added on every mount and never removed, and because it's an inline arrow there's no reference to remove it with — every mount of `StatusBar` leaks a listener that keeps the old component's closure alive. The interval is never cleared, so each mount, and each `serviceId` change, adds another interval; the old ones keep polling the *old* service and race to set status. A fetch in flight when the component unmounts or `serviceId` changes can also resolve late and overwrite fresh data. The fix is to return cleanup functions that mirror setup: keep a named handler and remove it, store the interval id and clear it, and abort in-flight requests with an `AbortController`.

## Explanation
### Bug 1 — listener never removed
```tsx
useEffect(() => {
  const onResize = () => setWidth(window.innerWidth); // named, so we can remove it
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);
```
Passing a *new* arrow to `removeEventListener` does nothing — the browser compares function references.

### Bug 2 — intervals pile up and poll stale ids
```txt
mount  serviceId=a  → interval#1 (polls a)
change serviceId=b  → interval#2 (polls b)   interval#1 still polling a!
navigate away/back  → interval#3 ...          all still running
```
Each stale interval calls `setStatus`, so the screen flickers between services, and the network tab fills with requests.

### Bug 3 — late responses
Even with `clearInterval`, a request that started just before cleanup can resolve afterwards and set stale data. Abort it.

### Fixed component
```tsx
function StatusBar({ serviceId }: { serviceId: string }) {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const [status, setStatus] = useState("unknown");

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function poll() {
      try {
        const res = await fetch(`/api/status/${serviceId}`, { signal: controller.signal });
        const data: { status: string } = await res.json();
        setStatus(data.status);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("error");
      }
    }

    poll(); // don't wait 5s for the first value
    const id = setInterval(poll, 5000);

    return () => {
      clearInterval(id);   // stop scheduling
      controller.abort();  // cancel anything in flight
    };
  }, [serviceId]);

  return <p>{width}px — {status}</p>;
}
```

### Cleanup checklist
| Setup | Cleanup |
|---|---|
| `addEventListener(type, fn)` | `removeEventListener(type, fn)` (same `fn`, same capture flag) |
| `setInterval` / `setTimeout` | `clearInterval` / `clearTimeout` |
| `fetch` | `controller.abort()` or an `ignore` flag |
| `new WebSocket` / subscription | `.close()` / `unsubscribe()` |
| `IntersectionObserver` / `ResizeObserver` | `.disconnect()` |
| third-party widget `init()` | `destroy()` |

### About the old warning
React 18 removed the "state update on an unmounted component" warning because it was often a false positive. The leak is still real — the warning just no longer tells you about it. StrictMode's extra setup/cleanup cycle in development is how you catch it now.

## Follow-ups
- **Can I use `{ signal }` for listeners too?** — Yes: `addEventListener("resize", fn, { signal: controller.signal })` and one `abort()` removes all of them.
- **Why poll with `setTimeout` recursion instead of `setInterval`?** — It guarantees one request finishes before the next starts, so slow responses can't overlap.

## Common Mistakes
- Removing a listener with a fresh inline function.
- Clearing the interval but not aborting in-flight requests.
- Reading `window` during the initial `useState` on a server-rendered page.

## Tips
- Say "cleanup mirrors setup" and walk the table. Then mention StrictMode as the tool that exposes missing cleanups.
