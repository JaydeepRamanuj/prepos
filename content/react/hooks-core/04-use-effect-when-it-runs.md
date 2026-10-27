---
title: "When does useEffect run? No array vs [] vs [deps]"
level: easy
type: concept
tags: [useEffect, dependencies, lifecycle]
related: [react/use-effect-cleanup, react/you-might-not-need-an-effect, react/use-layout-effect-vs-use-effect]
---

## Question
Explain when each of these effects runs and when its cleanup runs:

```tsx
useEffect(() => { /* A */ });
useEffect(() => { /* B */ }, []);
useEffect(() => { /* C */ }, [userId]);
```

## Interview Answer
Effects run after React commits the render to the DOM, typically after the browser has painted. With no dependency array, effect A runs after every render. With an empty array, B runs once after the component mounts and its cleanup runs on unmount. With `[userId]`, C runs after mount and then after any render where `userId` changed, compared with `Object.is`; before each re-run React calls the previous cleanup, and on unmount it calls the last cleanup. I think of effects as "synchronise with something outside React", not as lifecycle methods — the dependency array lists every reactive value the effect reads, and the linter enforces that.

## Explanation
### The three forms
| Form | Runs setup | Runs cleanup |
|---|---|---|
| `useEffect(fn)` | after every commit | before each next setup, and on unmount |
| `useEffect(fn, [])` | after mount | on unmount |
| `useEffect(fn, [a, b])` | after mount, and after commits where `a` or `b` changed | before the next setup, and on unmount |

In development under StrictMode there's one extra setup → cleanup cycle on mount.

### Timeline with `[userId]`
```txt
mount (userId=1)      → setup(1)
re-render (userId=1)  → nothing (deps equal)
re-render (userId=2)  → cleanup(1) → setup(2)
unmount               → cleanup(2)
```

### How deps are compared
Each dependency is compared to its previous value with `Object.is`. Primitives compare by value; objects, arrays and functions by reference. An object created during render is a new reference every time:

```tsx
const options = { roomId };            // new object every render
useEffect(() => { connect(options); }, [options]); // ❌ runs every render

useEffect(() => {
  const options = { roomId };          // ✅ create it inside the effect
  connect(options);
}, [roomId]);
```

### Dependencies aren't chosen, they're declared
Every prop, state, or value derived from them that the effect reads must be listed. If you don't want a value to re-trigger the effect, change the code (move it inside, use an updater function, or use an Effect Event) — don't lie to the linter.

### `useEffect` vs lifecycle methods
`[]` resembles `componentDidMount` + `componentWillUnmount`, but the better mental model is "start synchronising, stop synchronising". An effect for `roomId` connects to room 1 and disconnects from it; when `roomId` changes it stops and starts again.

## Follow-ups
- **Do effects run on the server?** — No. Effects only run in the browser, so they're safe for `window`/`document` access.
- **Do effects run in order?** — Within a component, in declaration order; across the tree, children's effects run before parents'.

## Common Mistakes
- Omitting a dependency to "run it once" — causes stale values.
- Putting objects/functions created during render into deps, causing infinite or excessive re-runs.
- Treating `[]` as `componentDidMount` and forgetting cleanup.

## Tips
- Draw the mount/update/unmount timeline — showing cleanup runs *before the next setup* is what separates a precise answer from a vague one.
