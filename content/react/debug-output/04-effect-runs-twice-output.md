---
title: "Predict the logs: Strict Mode, effects, cleanup and re-renders"
level: hard
type: output
tags: [strict-mode, useEffect, cleanup, output, lifecycle]
related: [react/strict-mode-double-invoke, react/use-effect-cleanup, react/use-effect-when-it-runs]
---

## Question
This app is rendered in `<StrictMode>` in development (React 19). After the first mount, the user clicks the button once. What is logged, in order?

```tsx
function App() {
  const [n, setN] = useState(0);
  console.log("render", n);

  useEffect(() => {
    console.log("effect", n);
    return () => console.log("cleanup", n);
  }, [n]);

  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
```

## Clues
- In development, Strict Mode renders twice and simulates unmount/remount once on mount.
- Cleanup of the previous effect runs before the next effect, using the previous render's values.
- The extra development-only render is a second call to the component function; React DevTools can dim or hide its logs.

## Interview Answer
On mount in Strict Mode the log is `render 0` (and React renders a second time to detect impurity, which the console may dim or hide, so `render 0` can appear twice), then `effect 0`, `cleanup 0`, `effect 0`, because Strict Mode mounts, simulates an unmount and remounts to check cleanup. After the click: `render 1` (again possibly twice, since dev renders twice on updates as well), then `cleanup 0` for the previous effect with its old closure, and `effect 1`. The effect doesn't double-run on updates, only on the initial mount. In production there is no double rendering or double effect, so you'd only see `render 0`, `effect 0`, then after the click `render 1`, `cleanup 0`, `effect 1`.

## Explanation
### Development (Strict Mode)

```txt
render 0             (React may call render twice; the second call's logs can be dimmed
render 0              by DevTools or hidden depending on React version and settings)
effect 0
cleanup 0            <- Strict Mode simulated unmount
effect 0             <- Strict Mode remount

(click)
render 1
render 1
cleanup 0            <- old effect cleans up with its own closure value
effect 1
```

### Production

```txt
render 0
effect 0
(click)
render 1
cleanup 0
effect 1
```

### Rules illustrated
1. **Render may run twice** in dev to catch impure rendering; the result of one call is discarded. Never put side effects in render.
2. **Mount-only effect double-invocation:** on the first mount only, React runs setup, cleanup, setup to ensure effects are resilient to remounting (as happens with `Activity`, Fast Refresh, Suspense and route caching).
3. **Order on update:** React renders, commits the DOM, runs the previous effect's cleanup, then the new effect.
4. **Cleanup uses its own closure:** `cleanup 0` logs `0` even though the state is now 1.
5. **Unmount:** the last cleanup runs when the component is removed (`cleanup 1`).

### Why Strict Mode does this
Effects must pair setup with cleanup. If an effect subscribes without cleanup, double-invoking exposes a duplicate subscription in dev. Fixing it makes the component safe for the real unmount/remount cycles.

### Practical implications
- A "run once" `fetch` in an effect will fire twice in dev; don't "fix" it with a ref guard; abort or ignore stale responses properly.
- Analytics events fired in effects will double in dev; track in event handlers or dedupe at the destination.
- Initialising non-idempotent global state in effects can break; make it idempotent.
- Don't rely on `console.log` counts in dev for performance conclusions; test a production build.

## Follow-ups
- **Does Strict Mode affect refs?** — React 19 also double-invokes ref callbacks on mount in dev.
- **Can I turn off the double effect?** — Remove `<StrictMode>`, but it hides real bugs; fix the effect instead.

## Common Mistakes
- Believing React has a bug when effects run twice.
- Using a ref flag to skip the second run.
- Assuming cleanup sees the latest state.

## Tips
- Say "dev-only, mount-only, checks cleanup symmetry".
