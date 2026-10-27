---
title: "What is useImperativeHandle, and when is an imperative API justified?"
level: advanced
type: concept
tags: [useImperativeHandle, refs, forwardRef, imperative, react-19]
related: [react/use-ref-dom-vs-mutable, react/ref-as-prop, react/controlled-vs-uncontrolled]
---

## Question
What does `useImperativeHandle` do? How do you expose methods like `focus()` or `reset()` from a child component in React 19, and when should you avoid it?

## Clues
- In React 19 function components receive `ref` as a normal prop.
- The hook customises the value that the parent receives through that ref.
- Prefer props and state whenever the thing can be expressed declaratively.

## Interview Answer
`useImperativeHandle(ref, () => api, deps)` lets a component decide what a parent sees in `ref.current`: instead of the raw DOM node, it exposes a limited object with methods such as `focus`, `scrollToTop` or `reset`. In React 19 `ref` is a regular prop for function components, so I accept `ref` directly and no longer need `forwardRef`. It's justified for imperative things that don't map to props: focus, scroll, play/pause media, triggering an animation or integrating a third-party widget. I avoid it for data flow, because lifting state or passing props is simpler and more predictable. It also hides internals, so the parent can't depend on implementation details of the DOM.

## Explanation
### React 19 version

```tsx
type FieldHandle = { focus: () => void; clear: () => void };

function TextField({ ref, label }: { ref?: React.Ref<FieldHandle>; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => setValue(""),
  }), []);

  return (
    <label>
      {label}
      <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} />
    </label>
  );
}

function Form() {
  const fieldRef = useRef<FieldHandle>(null);
  return (
    <>
      <TextField ref={fieldRef} label="Name" />
      <button onClick={() => fieldRef.current?.focus()}>Focus</button>
      <button onClick={() => fieldRef.current?.clear()}>Clear</button>
    </>
  );
}
```

### Before React 19

```tsx
const TextField = forwardRef<FieldHandle, Props>(function TextField(props, ref) {
  useImperativeHandle(ref, () => ({ /* ... */ }), []);
  // ...
});
```

`forwardRef` still works, but it is no longer needed for function components and React has said it will be deprecated in a future release.

### Why not expose the DOM node?
A narrow handle is a contract: you can change the internal markup without breaking parents, and parents can't mutate your DOM.

### When to use it
- Focus management after an action (for example, focusing the first invalid field).
- Scroll-to-item APIs on virtual lists.
- Media players (`play`, `pause`, `seek`).
- Wrapping imperative libraries (maps, charts, editors).
- Modal or dialog `open`/`close` where you can't control state from outside (although a prop is preferred).

### When to avoid it
- Reading or writing data: use props and callbacks.
- Opening/closing UI that could be controlled by an `open` prop.
- Chains of refs through many layers: consider context or restructuring.

### Details
- Dependencies matter: omit them and the handle is rebuilt each render; include dependencies the methods close over.
- Methods run in event handlers or effects, not during render.
- React 19 also lets ref callbacks return a cleanup function.

## Follow-ups
- **What about class components?** — Refs point to the instance, exposing everything; another reason the narrow handle is better.
- **Is `forwardRef` removed?** — No, it still works, but new code should use the `ref` prop.

## Common Mistakes
- Using it to pass data up instead of callbacks.
- Reading `ref.current` during render.
- Forgetting dependencies and exposing stale closures.

## Tips
- Name the declarative alternative first, then justify the exceptions.
