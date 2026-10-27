---
title: "How can you fix slow re-renders without any memoization?"
level: advanced
type: concept
tags: [state-colocation, composition, children, re-render, performance]
related: [react/why-component-rerenders, react/memoization-cost-benefit, react/lifting-state-up, react/children-slots]
---

## Question
A `Page` component holds a `hoverPosition` state that updates on every mouse move, and every move re-renders an expensive `<Chart />` and `<Sidebar />`. Without using `memo`, `useMemo` or `useCallback`, how would you fix it? Explain why your fix works.

```tsx
function Page() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}>
      <Tooltip pos={pos} />
      <Chart />
      <Sidebar />
    </div>
  );
}
```

## Clues
- Who actually needs `pos`? Can the state live lower in the tree?
- If the state must wrap the whole area, what happens to JSX that is passed in as `children`?
- Elements created by a parent are just objects. If the reference is unchanged, React skips them.

## Interview Answer
There are two structural fixes. The first is to **move state down**: put the state in the smallest component that needs it, so its updates re-render only that component. Here I extract a `MouseTracker` that owns `pos` and renders the `Tooltip`. The second applies when the state has to wrap expensive content: **lift the content up** by passing it as `children`. The `<Chart />` and `<Sidebar />` elements are then created by `Page`, which no longer re-renders on mouse move. When `MouseTracker` re-renders, its `children` prop is the same element reference as before, and React skips re-rendering it. Both fixes cut work without any memoization, and they also make the code easier to understand. That is why I reach for them before `memo`.

## Explanation
### Why the original is slow
`setPos` re-renders `Page`, and rendering is recursive, so `Chart` and `Sidebar` render on every mouse move even though they don't use `pos`.

### Fix 1: move state down

```tsx
function Page() {
  return (
    <>
      <MouseArea />  {/* owns the fast-changing state */}
      <Chart />      {/* unaffected */}
      <Sidebar />
    </>
  );
}

function MouseArea() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}>
      <Tooltip pos={pos} />
    </div>
  );
}
```

This works when the expensive siblings do not need to be inside the element that owns the state.

### Fix 2: pass the expensive part as children
Often the wrapping `div` has to contain the chart (the mouse area *is* the chart area). Then you lift the content up instead:

```tsx
function Page() {
  return (
    <MouseTracker>
      <Chart />
      <Sidebar />
    </MouseTracker>
  );
}

function MouseTracker({ children }: { children: React.ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}>
      <Tooltip pos={pos} />
      {children /* same element objects as last render, so React skips them */}
    </div>
  );
}
```

### Why fix 2 works
JSX like `<Chart />` creates an element object when the **creating** component renders. `Page` created those elements once. When `MouseTracker` re-renders, it receives the identical `children` reference, and React sees the same element, so it bails out of that subtree. This is the same mechanism `memo` relies on, but you get it from structure instead of comparison.

```txt
Page renders once        → creates {Chart element}, {Sidebar element}
MouseTracker re-renders  → children === previous children → skip
                         → Tooltip gets a new pos → re-render
```

### When colocation goes too far
Colocation pulls state down. Lifting state up pushes it toward a common parent when siblings must share it. The rule is to keep state **as low as possible, but as high as necessary**. If two distant components need the same fast-changing value, consider an external store with selectors instead of lifting it to the root.

### Does the React Compiler make this obsolete?
Partly. The compiler would cache the `<Chart />` elements in the original code. Colocation still pays off because it also shrinks the reconciliation work and keeps state ownership clear, and it works in codebases without the compiler.

## Follow-ups
- **Does the children trick work with render props?** No. A render prop is called during the child's render, so its output is new every time.
- **What about context?** The same idea applies: a provider component that takes `children` does not re-render those children itself. Only the consumers re-render.
- **Where does form state belong?** In the form component, not in a page-level or global store, unless something else really reads it.

## Common Mistakes
- Putting all state in the top-level page or a global store "to be safe".
- Believing `children` always re-render with their parent. They re-render with whichever component *created* them.
- Using `memo` as a patch over poorly placed state.

## Tips
- Name the two techniques: **move state down** and **lift content up**. They are easy to remember and sound senior.
- Explain *why* fix 2 works ("same element reference → bail out"). That is the part interviewers are probing.
