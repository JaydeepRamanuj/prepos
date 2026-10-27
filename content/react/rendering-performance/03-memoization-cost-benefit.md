---
title: "When are useMemo and useCallback worth it, and when are they wasted?"
level: medium
type: concept
tags: [usememo, usecallback, memoization, performance]
related: [react/react-memo-new-props, react/react-compiler, react/use-memo, react/use-callback]
---

## Question
A teammate wraps every function in `useCallback` and every derived value in `useMemo` "for performance". Is that a good idea? When does memoization actually pay off?

## Interview Answer
Memoization is not free. On every render React still runs the hook, compares the dependency array and keeps the old value in memory, and the code becomes harder to read. It pays off in three cases: the calculation is measurably expensive (around a millisecond or more on a real device), the value is passed to a `memo`-wrapped child that would otherwise re-render, or the value is a dependency of an effect or another hook and needs a stable identity. Outside those cases, wrapping everything adds cost without removing any work. In a project with the React Compiler enabled, I let the compiler handle this and keep manual `useMemo`/`useCallback` for places where I need precise control, such as effect dependencies.

## Explanation
### What each hook really does

```tsx
const sorted = useMemo(() => sortBy(items, key), [items, key]); // caches a value
const onSave = useCallback(() => save(id), [id]);               // caches a function
// useCallback(fn, deps) is the same as useMemo(() => fn, deps)
```

`useCallback` does **not** stop the inline function from being created. The arrow is still allocated on every render, and React simply returns the old one if the deps did not change. The benefit is the stable **identity**, not saved work.

### When it helps

| Situation | Why memoization helps |
|---|---|
| An expensive pure calculation (sorting or filtering thousands of rows, parsing) | Skips the work when the inputs are unchanged |
| A prop for a `React.memo` child | Keeps the reference stable, so the child's shallow compare passes |
| An effect dependency | Prevents the effect from re-running on every render |
| A value placed into context | Keeps all consumers from re-rendering when the provider's parent renders |

### When it is wasted
- Cheap work like `a + b`, `items.length` or string formatting. The hook overhead is larger than the work it saves.
- A callback passed to a plain DOM element (`<button onClick>`). DOM elements do not compare props.
- A callback passed to a child that is not memoized. That child re-renders anyway.
- Dependencies that change on every render anyway, such as an inline object. The cache never hits.

### Measure it
```tsx
console.time("filter");
const visible = items.filter((i) => i.name.includes(query));
console.timeEnd("filter");
```
Test with a production build and CPU throttling (4x–6x slowdown in the Performance panel). If the measured time is well under 1 ms, skip `useMemo`.

### Better than memoizing
Often the best fix is to restructure so that less re-renders: move state down to where it is used, or pass expensive subtrees as `children`. See state colocation.

### With the React Compiler
The compiler memoizes values, callbacks and JSX automatically, and it can memoize after early returns, which manual hooks cannot do. The React docs recommend relying on it for new code. Keep existing manual memoization unless you test the change, because removing it can change the compiler's output.

## Follow-ups
- **Is `useMemo` a semantic guarantee?** No. React treats it as a performance hint and may throw the cache away. Never rely on it for correctness, for example to "run something only once".
- **Why might `useMemo` make an app slower?** On a first render it does the work and adds overhead. On every later render it compares deps. If the result is rarely reused, you pay that cost for nothing.
- **What about `useMemo` for object props to a non-memo child?** It does nothing useful, because the child re-renders anyway.

## Common Mistakes
- Thinking `useCallback` prevents function creation.
- Listing a dependency array that includes an unstable object, so the memo recalculates on every render.
- Memoizing before measuring.

## Tips
- Answer with the three "pays off" cases: **expensive**, **memo child**, **dependency**. That structure sounds senior.
- Close with the compiler. It shows you know where React is heading.
