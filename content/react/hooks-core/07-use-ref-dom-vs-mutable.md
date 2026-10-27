---
title: "useRef — DOM refs vs mutable values, and how is it different from state?"
level: easy
type: concept
tags: [useRef, refs, dom, react-19]
related: [react/use-imperative-handle, react/stale-closures-in-effects, react/use-previous]
---

## Question
What is `useRef` used for? Show both uses — referencing a DOM node and storing a mutable value — and explain how a ref differs from state.

## Interview Answer
`useRef(initial)` returns a plain object `{ current: initial }` that React keeps the same across renders. I use it for two things: getting a DOM node — pass the ref to an element's `ref` attribute and React sets `current` to the node after commit — and holding mutable values that shouldn't trigger a render, like an interval id, a previous value, or a flag. The key difference from state is that changing `ref.current` doesn't re-render, and the change is visible immediately rather than in the next snapshot. Because of that, I don't read or write refs during render, only in effects and event handlers; if the value is shown on screen, it should be state.

## Explanation
### Use 1 — DOM access
```tsx
function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current?.focus()}>Search</button>
    </>
  );
}
```
`current` is `null` during the first render and gets the node during commit, so read it in handlers or effects. It's reset to `null` when the element unmounts.

### Use 2 — a mutable "instance variable"
```tsx
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  function start() {
    if (intervalRef.current !== null) return; // already running
    intervalRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
  }
  function stop() {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  useEffect(() => stop, []); // clear on unmount
  return <p>{elapsed}s <button onClick={start}>Start</button><button onClick={stop}>Stop</button></p>;
}
```
The interval id is needed by handlers but never displayed — a perfect ref.

### Ref vs state
| | `useRef` | `useState` |
|---|---|---|
| Change triggers re-render | No | Yes |
| Value after change | immediately updated (`ref.current`) | new value in the next render |
| Read during render | avoid (except lazy init) | yes |
| Good for | DOM nodes, timer ids, latest-value caches, flags | anything rendered |

### React 19 notes
- **`ref` is a regular prop** on function components, so `forwardRef` isn't needed for new code: `function Input({ ref, ...props }) { return <input ref={ref} {...props} /> }`.
- **Ref callbacks can return a cleanup function**, which React calls on detach instead of calling the callback with `null`.
- **TypeScript:** `useRef` now requires an argument (`useRef<T>(null)` or `useRef(undefined)`), and refs are mutable regardless of the initial value.

### Callback refs
For a list of nodes or to run code when a node appears, pass a function:
```tsx
<li ref={(node) => { map.set(id, node); return () => map.delete(id); }} />
```

## Follow-ups
- **Why not a plain `let` variable outside the component?** — It would be shared across all instances. A ref is per component instance.
- **Can you put a ref in effect dependencies?** — The ref object is stable, so it's pointless; `ref.current` changes don't trigger effects.

## Common Mistakes
- Displaying `ref.current` and expecting the UI to update.
- Reading `ref.current` during the first render and getting `null`.
- Using implicit returns in callback refs (`ref={n => (x = n)}`) — React 19 treats a returned value as a cleanup, and TypeScript rejects it.

## Tips
- One-liner: "A ref is a box React doesn't watch." Then list the two uses.
