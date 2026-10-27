---
title: "What does useMemo do, and what are valid reasons to use it?"
level: medium
type: concept
tags: [useMemo, memoization, referential-equality, performance]
related: [react/use-callback, react/use-memo-when-pointless, react/memoization-cost-benefit, react/react-compiler]
---

## Question
Explain `useMemo`: what it caches, when it recomputes, and the legitimate reasons to use it. Is it a semantic guarantee?

## Interview Answer
`useMemo(() => compute(a, b), [a, b])` caches the result of a calculation between renders and recomputes only when a dependency changes, comparing with `Object.is`. There are two valid reasons: skipping a genuinely expensive calculation, and keeping a stable reference to an object or array so that memoised children (`React.memo`) or other hooks' dependency arrays don't see a new value every render. It is a performance hint, not a semantic guarantee: React may discard cached values, so correctness must not depend on it. I measure first, because memoisation itself costs memory and comparison time, and with the React Compiler enabled most manual memoisation becomes unnecessary.

## Explanation
### Usage

```tsx
function ProductList({ products, query }: Props) {
  const visible = useMemo(
    () => products.filter((p) => matches(p, query)).sort(byPrice),
    [products, query]
  );
  return <List items={visible} />;
}
```

The function runs during render and must be pure. On the next render, if `products` and `query` are the same, React returns the previous array.

### Valid uses

| Reason | Example |
|---|---|
| Expensive pure computation (measured slow, e.g. > 1 ms) | filtering/sorting thousands of rows, parsing |
| Stable reference passed to a `memo` child | `const style = useMemo(() => ({ ... }), [x])` |
| Stable reference as a dependency of `useEffect`/another hook | an options object |
| Keeping identity for context values | `useMemo(() => ({ user, login }), [user, login])` |

### Invalid or pointless uses
- Wrapping trivial work (`a + b`, a short `.map`): overhead exceeds benefit.
- Memoising for correctness (for example, to guarantee a side effect runs once).
- When the dependencies change on every render anyway.
- When the child isn't memoised, so a stable reference accomplishes nothing.

### How to check it's needed
1. Use React DevTools Profiler to find slow commits.
2. Time the calculation with `console.time` (in a production build: dev is slower).
3. Try CPU throttling to mimic low-end devices.

### Common bug

```tsx
const user = useMemo(() => ({ name }), []);   // missing dep `name`: stale object
```

The exhaustive-deps lint rule catches it.

### React Compiler
It automatically memoises components and values it can prove safe, so new code can usually omit `useMemo`. Keep manual `useMemo` where the compiler can't see intent, or for effect dependencies where you need precise control. Existing `useMemo` calls remain valid.

### Alternatives
Move state down so fewer components render; derive less; virtualise long lists; compute on the server.

## Follow-ups
- **Does `useMemo` run on the first render?** — Yes, always; it only skips on later renders.
- **Can React throw away the cache?** — Yes (for example, offscreen trees); treat it as an optimisation.

## Common Mistakes
- Memoising everything by default.
- Missing dependencies.
- Putting side effects inside `useMemo`.

## Tips
- Lead with "measure first" and mention the compiler.
