---
title: "Controlled inputs in forms: typing lag, cursor jumps and re-render cost"
level: medium
type: debugging
tags: [forms, controlled-inputs, performance, onChange, cursor]
related: [react/controlled-vs-uncontrolled, react/state-colocation, react/memoization-cost-benefit, react/use-deferred-value]
---

## Question
A large form with 40 controlled inputs feels laggy on each keystroke, and one formatted phone input jumps the cursor to the end. Why do these happen and how do you fix them?

```tsx
function Checkout() {
  const [form, setForm] = useState({ name: "", phone: "", /* …38 more */ });

  return (
    <form>
      {FIELDS.map((f) => (
        <Field key={f.name} label={f.label}
               value={form[f.name]}
               onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
      ))}
      <OrderSummary />
    </form>
  );
}
```

## Interview Answer
Each keystroke calls `setForm` in the parent, which re-renders the parent and all 40 fields plus `OrderSummary`, even though one value changed. To fix it, I colocate state: give each field its own state, or use an uncontrolled approach like React Hook Form, which registers refs and avoids per-keystroke renders. If the state must stay in the parent, I wrap fields in `memo` with stable `onChange` handlers and use a functional update (`setForm(f => ({...f, [name]: value}))`) so the handler doesn't depend on `form`. For the phone input, cursor jumps occur when the formatted value I set differs from what the browser holds: React sets `value` programmatically, and the caret goes to the end; to fix it, save `selectionStart` before updating and restore it after render in a layout effect, or use a masking library. Heavier derived UI such as the summary can use `useDeferredValue`.

## Explanation
### Why it re-renders everything
State lives at the top; `setForm` triggers a render of `Checkout`, which re-renders every child because children re-render when parents do (unless memoised), and `onChange` is a new function each time.

### Fix 1: colocate or isolate

```tsx
function Field({ name, label }: { name: string; label: string }) {
  const [value, setValue] = useState("");                  // owns its state
  return <label>{label}<input name={name} value={value} onChange={(e) => setValue(e.target.value)} /></label>;
}
```

Read all values on submit via `FormData` (`new FormData(e.currentTarget)`), or lift only what other components need.

### Fix 2: memoised fields with stable handlers

```tsx
const Field = memo(function Field({ name, label, value, onChange }: FieldProps) {
  return <label>{label}<input value={value} onChange={(e) => onChange(name, e.target.value)} /></label>;
});

const handleChange = useCallback((name: string, value: string) => {
  setForm((f) => ({ ...f, [name]: value }));              // no dependency on `form`
}, []);
```

Now only the changed field gets a new `value` prop and re-renders. With the React Compiler, memoisation is mostly automatic.

### Fix 3: use a form library
React Hook Form registers inputs as uncontrolled and subscribes selectively (`watch`, `useWatch`), so typing in one field doesn't re-render the form. Formik re-renders more by default.

### Fix 4: defer expensive derived UI

```tsx
const deferredForm = useDeferredValue(form);
<OrderSummary form={deferredForm} />                      // updates in low-priority renders
```

### The cursor-jump bug
When you transform the value (formatting `1234567890` to `(123) 456-7890`) the browser's caret position is lost because React replaces the value.

```tsx
function PhoneInput({ value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef(0);

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const digitsBefore = raw.slice(0, e.target.selectionStart ?? 0).replace(/\D/g, "").length;
    const formatted = formatPhone(raw);
    caret.current = positionAfterDigits(formatted, digitsBefore);
    onChange(formatted);
  }

  useLayoutEffect(() => {
    ref.current?.setSelectionRange(caret.current, caret.current);   // restore after the DOM updates
  }, [value]);

  return <input ref={ref} value={value} onChange={handle} inputMode="tel" />;
}
```

Alternatively, format on blur only, or use a mask library.

### Other tips
- Never define a component inside another component: it remounts on each render and the input loses focus after each keystroke.
- Keys must be stable; an unstable `key` also resets focus.
- Don't store derived values (like errors) in state if you can compute them.
- Debounce expensive validation, not the input's own state.

## Follow-ups
- **Why does an input lose focus when typing?** — The component containing it is re-created (defined inline or changing `key`).
- **Controlled vs uncontrolled for performance?** — Uncontrolled avoids renders; controlled enables live UI.

## Common Mistakes
- Debouncing the controlled `onChange` (typing feels broken).
- Defining field components inside the form component.

## Tips
- Diagnose with the React Profiler first; name what rendered and why.
