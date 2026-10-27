---
title: "What causes a React component to re-render?"
level: easy
type: concept
tags: [rendering, re-render, state, context, props]
related: [react/react-memo-new-props, react/state-colocation, react/context-performance]
---

## Question
Name every reason a function component re-renders. Interviewers usually follow up with: "Does a component re-render when its props change?"

## Interview Answer
A component re-renders for four reasons: its own state changes (via a `useState`/`useReducer` setter), its parent re-renders, a context it reads changes value, or a hook it uses triggers an update. A hook's state belongs to the component that calls it, so a custom hook's `setState` re-renders the host component. "Props changed" is not a separate trigger. Props can only change because the parent re-rendered, and when the parent re-renders the child re-renders whether or not its props changed, unless it is wrapped in `React.memo`. A re-render means React calls the function again and diffs the result. It does not necessarily touch the DOM.

## Explanation
### The four triggers

| Trigger | Example |
|---|---|
| State update | `setCount(c => c + 1)` |
| Parent re-render | `<Parent>` re-renders, so every child it renders is called again |
| Context change | `<ThemeContext value={theme}>` gets a new `theme`, so every consumer re-renders |
| Hook update | `useSyncExternalStore` sees a new snapshot, or a custom hook calls its internal setter |

The fourth item is really the first one in another form, since every hook update comes down to a state update in the component that calls the hook. Listing it separately is still useful, because people forget that `useWindowSize()` re-renders the component on every resize.

### The props myth

```tsx
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>+</button>
      <Child /> {/* no props, but still re-renders on every click */}
    </>
  );
}
```

`Child` takes no props, yet it re-renders on every click because rendering is recursive by default. React does not compare props unless you opt in with `React.memo` (or the React Compiler does it for you).

### A re-render is not a DOM update
A render calls your function and produces a new element tree. React then reconciles it with the previous tree and commits only the DOM changes it finds. Most re-renders are cheap. They become a problem only when a render is expensive, or when a single update re-renders hundreds of components.

### Bail-outs
If you set state to the same value (checked with `Object.is`), React usually skips re-rendering that component and its children. This is why `setUser({...user})` always re-renders but `setCount(5)` while the count is already 5 does not.

## Follow-ups
- **Does setting state to the same value ever render?** React may render the component once more before bailing out, but it does not re-render the children or run effects again.
- **Does a context change re-render components that don't read it?** Not directly. Only consumers re-render, but their children re-render as normal.
- **How do you see why something re-rendered?** Turn on "Record why each component rendered while profiling" in React DevTools.

## Common Mistakes
- Saying "a component re-renders when its props change", which implies a props comparison that does not happen by default.
- Treating every re-render as a performance bug. Measure first.
- Assuming that mutating an object and calling `setState(sameObject)` will re-render. `Object.is` sees the same reference and bails out.

## Tips
- Memorise it as **S-P-C-H**: State, Parent, Context, Hooks.
- Volunteer the props myth before they ask. It is the trap the question is designed to test.
