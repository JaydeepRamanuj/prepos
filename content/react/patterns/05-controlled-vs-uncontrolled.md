---
title: "Controlled vs uncontrolled components: how do you support both?"
level: medium
type: concept
tags: [controlled, uncontrolled, forms, refs, inputs]
related: [react/lifting-state-up, react/use-imperative-handle, react/forms-controlled-inputs]
---

## Question
What is the difference between controlled and uncontrolled components? When would you choose each, and how would you build a reusable component (for example `Toggle` or `TextField`) that supports both modes?

## Interview Answer
In a controlled component React state is the source of truth: the input's `value` comes from props or state and every change goes through `onChange`. In an uncontrolled component the DOM holds the value; you read it when needed via a ref, `FormData` or the form submit event, and can seed it with `defaultValue`. Controlled gives instant validation, derived UI and masking at the cost of re-renders on each keystroke; uncontrolled is simpler and cheaper for forms that only need values on submit, and is what native forms and React 19 form Actions work well with. Reusable components often support both: if the `value` prop is provided, use it; otherwise manage internal state initialised from `defaultValue`. Switching between modes during the lifetime of an input triggers a warning.

## Explanation
### The two modes

```tsx
// Controlled
const [name, setName] = useState("");
<input value={name} onChange={(e) => setName(e.target.value)} />

// Uncontrolled
const ref = useRef<HTMLInputElement>(null);
<input defaultValue="Asha" ref={ref} />
<button onClick={() => console.log(ref.current?.value)}>Read</button>

// Uncontrolled with FormData and a form Action (React 19)
<form action={(fd) => save(fd.get("name") as string)}>
  <input name="name" defaultValue="Asha" />
  <button>Save</button>
</form>
```

### Comparison

| | Controlled | Uncontrolled |
|---|---|---|
| Source of truth | React state | DOM |
| Initial value | `value` | `defaultValue` |
| Read value | state | ref / FormData |
| Re-render per keystroke | yes | no |
| Live validation / formatting | easy | harder |
| Reset | set state | `form.reset()` / `key` |
| File inputs | always uncontrolled | |

### Supporting both modes in a component

```tsx
function useControllableState<T>({
  value, defaultValue, onChange,
}: { value?: T; defaultValue: T; onChange?: (v: T) => void }) {
  const [inner, setInner] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : inner;

  const set = useCallback((next: T) => {
    if (!isControlled) setInner(next);
    onChange?.(next);                     // always notify the parent
  }, [isControlled, onChange]);

  return [current, set] as const;
}

function Toggle(props: { checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (c: boolean) => void }) {
  const [checked, setChecked] = useControllableState({
    value: props.checked,
    defaultValue: props.defaultChecked ?? false,
    onChange: props.onCheckedChange,
  });
  return <button role="switch" aria-checked={checked} onClick={() => setChecked(!checked)} />;
}
```

This is the pattern used by Radix UI and others.

### Rules and warnings
- Passing `value` without `onChange` makes a read-only input and logs a warning.
- Switching `undefined` to a defined `value` triggers "changing an uncontrolled input to be controlled"; initialise state with `""`, not `undefined`.
- To reset an uncontrolled subtree, change its `key`.

### Choosing
- Controlled: dependent fields, live validation, formatting, character counters, search-as-you-type.
- Uncontrolled: simple forms submitted once, performance-sensitive large forms (React Hook Form is uncontrolled under the hood), file inputs.

## Follow-ups
- **Why is React Hook Form fast?** — It registers uncontrolled inputs and reads values via refs, avoiding per-keystroke re-renders.
- **How do you reset a controlled form?** — Reset the state.

## Common Mistakes
- Initialising controlled state as `undefined`.
- Mixing `value` and `defaultValue`.
- Forgetting `onChange`.

## Tips
- Mention `useControllableState`; it shows library-level thinking.
