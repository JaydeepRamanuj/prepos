---
title: "How does useContext work, and why do all consumers re-render?"
level: medium
type: concept
tags: [useContext, context, rerenders, provider, performance]
related: [react/context-performance, react/use-reducer-vs-use-state, react/state-colocation, react/why-component-rerenders]
---

## Question
How do `createContext`, a Provider and `useContext` work? When does a consumer re-render, and how would you avoid unnecessary re-renders when the context value changes?

## Interview Answer
`createContext` makes a channel with a default value, a Provider supplies a value to its subtree, and `useContext` reads the nearest Provider's value, skipping props drilling. When the Provider's `value` changes (by `Object.is`), every component that calls `useContext` for that context re-renders, even if it only uses part of the value, and `React.memo` on those components does not stop it. A common mistake is passing a new object literal as `value` on every render, which re-renders all consumers whenever the Provider's parent renders. Mitigations: memoise the value, split contexts by update frequency, separate state from dispatch, move state down, or use a store with selectors for fast-changing data.

## Explanation
### Basics

```tsx
const ThemeContext = createContext<"light" | "dark">("light");

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <ThemeContext value={theme}>        {/* React 19: render the context directly, no .Provider */}
      <Page />
    </ThemeContext>
  );
}

function Button() {
  const theme = useContext(ThemeContext);   // also callable after early returns via use(ThemeContext)
  return <button className={theme}>OK</button>;
}
```

In React 19 `<Context>` works as a provider; `<Context.Provider>` still works. `use(Context)` can read context conditionally.

### Why consumers re-render
Context has no selector. React compares the `value` with `Object.is`; if different, all consumers are scheduled to re-render.

```tsx
// New object each render: every consumer re-renders whenever App renders
<AuthContext value={{ user, login }}>
```

### Fixes

```tsx
// 1. Memoise the value
const value = useMemo(() => ({ user, login }), [user, login]);

// 2. Split state and actions (dispatch/stable callbacks rarely change)
<StateContext value={state}>
  <DispatchContext value={dispatch}>{children}</DispatchContext>
</StateContext>

// 3. One context per concern or per update frequency (theme vs. cursor position)

// 4. Pass children as props so the provider's re-render doesn't re-render the subtree
function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(init);
  return <Ctx value={state}>{children}</Ctx>;     // children identity is stable
}
```

### What context is good for
Low-frequency, app-wide values: theme, locale, current user, feature flags, a router.

### What it's not good for
High-frequency state (mouse position, form keystrokes, large tables). Use state colocation, `useSyncExternalStore`-based stores such as Zustand with selectors, or the React Compiler's memoisation for the surrounding components.

### Also
- The default value is only used when there is no Provider above.
- Consumers inside a memoised parent still update, because the subscription is direct.
- Multiple providers can nest and override.

## Follow-ups
- **Does `useMemo` on the value solve everything?** — Only for spurious changes; real changes still re-render all consumers.
- **How can you get selector-like behaviour?** — Split contexts, or use `use-context-selector`, or a store library.

## Common Mistakes
- Passing inline objects to `value`.
- Putting rapidly changing state in a global context.
- Expecting `React.memo` to block context updates.

## Tips
- Say "no selectors" and offer the three standard mitigations.
