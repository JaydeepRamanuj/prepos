---
title: "Render props and higher-order components: what are they and are they still relevant?"
level: medium
type: concept
tags: [render-props, hoc, hooks, patterns, composition]
related: [react/children-slots, react/custom-hook-design-rules, react/compound-components]
---

## Question
Explain render props and higher-order components (HOCs). What problems did they solve, what are their drawbacks, and why did hooks replace most uses? When might you still use them?

## Interview Answer
Both patterns share logic between components. A render prop is a prop whose value is a function that returns JSX; the component calls it with its internal data, like `<Mouse>{({x, y}) => <Cursor x={x} y={y} />}</Mouse>`. A higher-order component is a function that takes a component and returns an enhanced component, like `withAuth(Dashboard)`. Their drawbacks are indirection: HOCs cause wrapper hell, prop name collisions and lost refs or static properties; render props cause nested callback pyramids. Custom hooks solve the same problem, sharing stateful logic, with plain function calls in a flat structure. I still use render props when a component must supply data to markup the caller controls (virtualised list rows, `Formik`-style form state, headless components), and HOCs occasionally for cross-cutting wrapping like error boundaries or instrumentation.

## Explanation
### Render prop

```tsx
function MouseTracker({ children }: { children: (pos: { x: number; y: number }) => ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div onPointerMove={(e) => setPos({ x: e.clientX, y: e.clientY })}>
      {children(pos)}
    </div>
  );
}

<MouseTracker>{({ x, y }) => <p>{x}, {y}</p>}</MouseTracker>
```

### HOC

```tsx
function withAuth<P extends object>(Component: React.ComponentType<P>) {
  function Wrapped(props: P) {
    const user = useUser();
    if (!user) return <Redirect to="/login" />;
    return <Component {...props} />;
  }
  Wrapped.displayName = `withAuth(${Component.displayName ?? Component.name})`;
  return Wrapped;
}

const ProtectedDashboard = withAuth(Dashboard);
```

### As a hook

```tsx
function useMouse() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", h);
    return () => window.removeEventListener("pointermove", h);
  }, []);
  return pos;
}
const { x, y } = useMouse();     // no wrapper, no nesting
```

### Comparison

| | HOC | Render prop | Custom hook |
|---|---|---|---|
| Shares | behaviour + props | data to markup | stateful logic |
| Nesting | wrapper per HOC | callback per component | none |
| Prop collisions | possible | none | none |
| Typing | complex generics | moderate | easy |
| Works for non-UI logic | no | no | yes |

### HOC pitfalls
- Never create the HOC result inside render (`withX(Component)` in a component body creates a new type each render and remounts).
- Hoist statics (`hoist-non-react-statics`) and forward refs.
- Set `displayName` for DevTools.

### Where each still fits
- Render props / function-as-children: virtualised lists (`renderItem`), headless components, anything exposing internal state to caller markup (Downshift, React Hook Form's `Controller`).
- HOCs: legacy code, library integration (`connect`, `withRouter` in old versions), uniform wrapping such as `withErrorBoundary`.
- Hooks: everything else.

## Follow-ups
- **Can a render prop be named `children`?** — Yes; function-as-children is a common variant.
- **Do render props re-render more?** — The inline function is new each render; usually fine, memoise only if needed.

## Common Mistakes
- Using HOCs for logic a hook would handle.
- Creating the enhanced component inside another component.

## Tips
- Show the same example three ways; the comparison makes the answer.
