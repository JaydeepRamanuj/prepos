---
title: "When would you use useDeferredValue?"
level: hard
type: concept
tags: [useDeferredValue, concurrent-rendering, search, performance]
related: [react/use-transition, react/memoization-cost-benefit, react/list-virtualization]
---

## Question
What does `useDeferredValue` do? Build a search box over a big list where typing stays responsive, and explain what makes it work and when it doesn't help.

## Clues
- The input must update immediately while the slow list is allowed to catch up.
- React can render twice per keystroke: once urgently, once in the background.
- The slow child needs to be skippable during the urgent render.

## Interview Answer
`useDeferredValue(value)` returns a copy of a value that may lag behind the real one. On an update, React first re-renders with the old deferred value, so urgent UI such as the input updates immediately, then re-renders in the background with the new value; if more input arrives, the background render is abandoned and restarted. It's like a transition for a value I don't control the setter of. For search, I keep the input bound to the real state and pass the deferred query to the expensive list. For it to help, the list must be memoised (`memo`) so the first urgent render skips it, and the cost must be in React rendering. I can compare `query !== deferredQuery` to show a stale-results style. It doesn't reduce network requests.

## Explanation
### Example

```tsx
function Search({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        <Results items={items} query={deferredQuery} />
      </div>
    </>
  );
}

const Results = memo(function Results({ items, query }: Props) {
  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
  return <ul>{filtered.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
});
```

### What happens on a keystroke
1. Render 1 (urgent): `query = "ab"`, `deferredQuery = "a"` (old). The input updates; `Results` receives the same props and, because it is `memo`, is skipped.
2. Render 2 (background, interruptible): `deferredQuery = "ab"`; `Results` renders.
3. Typing another character interrupts render 2 and starts again.

### Requirements for it to help
- The deferred value feeds an expensive subtree, ideally wrapped in `memo` (or the React Compiler) so the urgent render can skip it.
- The work is rendering, not a network call or a sync loop outside React.
- Without memoisation, the first render still re-renders the slow child with the old value, and there's no gain.

### With Suspense
If the deferred render suspends (data loading), React keeps showing the previous UI instead of the fallback, as with transitions.

### Initial value (React 19)

```tsx
const deferred = useDeferredValue(value, "");   // first render uses "", then updates to value
```

Useful to render something quick on mount and refine afterwards.

### Choosing

| Situation | Tool |
|---|---|
| You own the `setState` call | `useTransition` |
| You receive the value (prop, URL param) | `useDeferredValue` |
| Too many network calls | debounce / abort |
| Thousands of rows | virtualise, plus one of the above |

### Caveats
- It doesn't skip work, only reorders it; total CPU is similar.
- If rendering is fast, there's no visible difference.
- Values compared by `Object.is`; deferring a fresh object each render defeats the effect.

## Follow-ups
- **Why does the input stay fast?** — Its update is urgent and render 1 skips the heavy child.
- **Can I defer an object?** — Yes, but only if its identity is stable between renders.

## Common Mistakes
- Using it without `memo` on the slow child.
- Expecting fewer API calls.

## Tips
- Show the two-render sequence; it demonstrates real understanding.
