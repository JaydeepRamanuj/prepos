---
title: "Refs in React 19: ref as a prop, callback refs with cleanup, and forwardRef"
level: medium
type: concept
tags: [refs, forwardRef, callback-refs, react-19, dom]
related: [react/use-imperative-handle, react/use-ref-dom-vs-mutable, react/react-18-to-19-changes]
---

## Question
How do you pass a ref to a child component in React 19 compared to React 18? What changed for callback refs, and what is `forwardRef` still needed for?

## Interview Answer
In React 18 a function component couldn't receive `ref` as a normal prop, so you had to wrap it in `forwardRef((props, ref) => ...)`. In React 19, `ref` is just a prop for function components: you destructure it and pass it on, so `forwardRef` is no longer needed in new code. Callback refs can now return a cleanup function that React calls when the element is detached, which replaces the old pattern of being called with `null`. `forwardRef` still works for existing code and for class components wrapping, but is expected to be deprecated later. For exposing custom methods instead of the DOM node, you combine the `ref` prop with `useImperativeHandle`.

## Explanation
### React 18

```tsx
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <input ref={ref} {...props} />;
});
```

### React 19

```tsx
function Input({ ref, ...props }: React.ComponentProps<"input">) {
  return <input ref={ref} {...props} />;
}

function Form() {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Input ref={inputRef} placeholder="Name" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </>
  );
}
```

`React.ComponentProps<"input">` already includes `ref`, so `{...props}` can carry it automatically.

### Callback refs with cleanup

```tsx
<div
  ref={(node) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();       // React 19: called on detach
  }}
/>
```

Caveat: because a returned function now means "cleanup", an arrow function with an implicit return of something (like `ref={(el) => (instance = el)}`) is flagged by TypeScript; use braces.

In React 18, callback refs were called with `null` on unmount; in 19 with a cleanup function they're not called with `null`.

### Stable callback refs
A new inline callback each render makes React call the cleanup and the callback again every render. Define it with `useCallback` when the side effects are expensive.

### Refs for other purposes
- DOM access: focus, scroll, measure.
- Instance values: timer ids, previous values (see state vs ref).
- Don't read or write `ref.current` during render.

### Comparing approaches

| Need | Approach |
|---|---|
| Parent needs the DOM node | pass `ref` prop through |
| Parent needs methods | `useImperativeHandle` |
| Parent should control behaviour | props (`open`, `value`) |
| Observe element size/visibility | callback ref with cleanup or an effect |

### Migration
Codemods exist to convert `forwardRef` usages. Libraries supporting both React 18 and 19 still use `forwardRef`.

## Follow-ups
- **Does `ref` appear in `props` in Server Components?** — Refs are for client-side DOM access, so they only apply in Client Components.
- **What about `displayName`?** — Not required for the prop approach; function name is used.

## Common Mistakes
- Keeping `forwardRef` everywhere in new React 19 code.
- Returning a non-function value from a callback ref accidentally.

## Tips
- Mention callback-ref cleanup; it's a React 19 detail interviewers like.
