---
title: "How does the useEffect dependency array work? Why do objects and functions cause trouble?"
level: medium
type: concept
tags: [useEffect, dependencies, referential-equality, Object.is, exhaustive-deps]
related: [react/use-effect-when-it-runs, react/stale-closures-in-effects, react/you-might-not-need-an-effect, react/use-callback]
---

## Question
How does React decide whether to re-run an effect? What goes wrong if you put an object, array or function in the dependency array, and what are your options?

## Interview Answer
After each render React compares the new dependency array with the previous one, item by item, using `Object.is`. If any entry differs, it runs the previous cleanup and then the effect again; with an empty array it runs only on mount, and with no array it runs after every render. Primitives compare by value, but objects, arrays and functions created during render are new references every time, so an effect depending on them re-runs on every render, which can cause loops or repeated fetches. The dependencies are not a trigger I choose; they must list every reactive value the effect reads. To fix unstable dependencies I move values outside the component, depend on primitives, memoise with `useMemo`/`useCallback`, move the logic into the effect, or restructure so the effect isn't needed.

## Explanation
### The comparison

```tsx
useEffect(() => {
  document.title = `${count} items`;
}, [count]);          // reruns only when Object.is(prevCount, count) is false
```

| Array | When it runs |
|---|---|
| none | after every render |
| `[]` | after mount only (and cleanup on unmount) |
| `[a, b]` | after mount and whenever `a` or `b` changes |

### The unstable reference problem

```tsx
function Search({ query }: { query: string }) {
  const options = { q: query, limit: 10 };         // new object every render

  useEffect(() => {
    fetchResults(options).then(setResults);
  }, [options]);                                   // runs after every render -> setResults -> render -> ...
}
```

### Fixes

```tsx
// 1. Depend on primitives and build the object inside
useEffect(() => {
  fetchResults({ q: query, limit: 10 }).then(setResults);
}, [query]);

// 2. Hoist constants outside the component
const OPTIONS = { limit: 10 };

// 3. Memoise when the object is genuinely needed in several places
const options = useMemo(() => ({ q: query, limit: 10 }), [query]);

// 4. Functions: define inside the effect, or wrap in useCallback
const load = useCallback(() => fetchResults(query), [query]);
useEffect(() => { load(); }, [load]);
```

With the React Compiler enabled, objects and functions are memoised automatically in most cases, but writing effects with primitive deps is still the most robust approach.

### Rules of thumb
- The dependency list describes what the effect *reads*, not when you want it to run. If you need different timing, change the code, not the array.
- Setting state unconditionally inside an effect with a deps array of an unstable value creates an infinite loop.
- Refs (`ref.current`) and `setState` functions are stable and not needed in deps.
- Props and state from the component body are reactive; module-level constants are not.
- Prefer deriving values during render over syncing them with effects.

### Debugging
Log which dependency changed:

```tsx
useEffect(() => { /* ... */ }, [a, b, c]);
// inspect with the React DevTools profiler "why did this render" or a usePrevious helper
```

## Follow-ups
- **What about `NaN`?** — `Object.is(NaN, NaN)` is true, so it does not cause re-runs.
- **Can the dependency array be dynamic in length?** — No; its length must not change between renders.

## Common Mistakes
- Omitting dependencies to "run once".
- Putting an inline object or arrow function in the array.
- Treating the array as a trigger list instead of a dependency list.

## Tips
- Mention `Object.is` and the exhaustive-deps lint rule by name.
