---
title: "Why does my event listener fire twice?"
level: easy
type: debugging
tags: [strict-mode, useeffect, event-listeners, cleanup]
related: [debugging/memory-leak-uncleared-subscription, debugging/stale-closure-interval]
---

## Question
Pressing <kbd>Escape</kbd> should close the modal and log once. In development it logs twice, and after opening the modal a few times it logs four, six, eight times. What is wrong?

```tsx
function Modal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        console.log("closing");
        onClose();
      }
    });
  }, [onClose]);

  return <div role="dialog">…</div>;
}
```

## Interview Answer
There are two separate causes. The effect adds a listener but never removes it, so every mount — and every time `onClose` changes identity — stacks another listener on `document`, which is why the count keeps growing. The "twice from the first open" part comes from StrictMode in development: React mounts, unmounts and re-mounts every component once to surface exactly this missing cleanup. The fix is to give the listener a name and return a cleanup that calls `removeEventListener` with the same function reference. Then StrictMode's extra mount is harmless and production behaves the same.

## Explanation
### What happens step by step

```txt
StrictMode dev mount:   effect runs   → listener A added
                        cleanup runs  → (nothing removed!)
                        effect runs   → listener B added      → Escape logs 2×
parent re-renders, new onClose:
                        effect runs   → listener C added      → Escape logs 3×
modal closes & reopens: more listeners …
```

StrictMode does not create the bug; it reveals it. In production the count would still grow on every re-open and every `onClose` change.

### The fix

```tsx
function Modal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return <div role="dialog">…</div>;
}
```

Key points:
- `removeEventListener` needs the **same function reference** and the same `capture` option. Passing a new arrow function removes nothing.
- An alternative is an `AbortController`: `addEventListener("keydown", fn, { signal: controller.signal })` and `return () => controller.abort()`. One `abort()` removes every listener registered with that signal.

### Other reasons a handler runs twice
| Symptom | Cause |
|---|---|
| Fires twice only in dev | StrictMode re-mount + missing cleanup, or a side effect inside render/state updater (StrictMode double-invokes those) |
| Fires twice on one click | Event bubbles to a parent with the same handler; or both `onClick` on the element and a native listener |
| `onClick` and `onSubmit` both fire | A `<button>` inside a `<form>` defaults to `type="submit"` |
| Data fetched twice | Effect fetch under StrictMode — fine if you abort/ignore in cleanup; a data library dedupes it |

Do not "fix" it by removing `<StrictMode>`: you would hide the leak, not remove it.

## Follow-ups
- **Why does React double-mount in StrictMode?** — To check that effects are resilient to being set up and torn down, which features like Fast Refresh and preserving state for hidden UI rely on.
- **Can you use a ref flag to run the effect only once?** — You can, but it fights the check instead of fixing the missing cleanup; it is usually a code smell.
- **How do you avoid re-subscribing whenever `onClose` changes?** — Read the latest `onClose` through `useEffectEvent` (stable in React 19.2) or a ref, so the effect can have `[]` deps.

## Common Mistakes
- Passing an inline arrow to `removeEventListener`, which removes nothing.
- Deleting `<StrictMode>` to make the double log go away.
- Forgetting that `once: true` only helps if you really want a single call ever.

## Tips
- Rule of thumb: every `add` in an effect needs a matching `remove` in its cleanup — "subscribe in setup, unsubscribe in cleanup".
- Mention `AbortController` for listeners; it is a neat modern touch.
