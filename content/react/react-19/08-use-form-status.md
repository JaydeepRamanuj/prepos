---
title: "What does useFormStatus do, and what's the catch?"
level: medium
type: concept
tags: [useFormStatus, forms, react-dom, actions, pending]
related: [react/use-action-state, react/use-optimistic, react/react-18-to-19-changes]
---

## Question
What does `useFormStatus` return? Why does it only work in a child of the form, and when would you use it instead of `useActionState`'s `isPending`?

## Interview Answer
`useFormStatus()` from `react-dom` returns `{ pending, data, method, action }` for the nearest parent `<form>` that is currently submitting through a function Action. It lets a design-system component, like a `SubmitButton`, show a spinner or disable itself without receiving props. The catch is that it reads the status of a *parent* form, so it must be called in a component rendered inside the form, not in the component that renders the `<form>` itself; otherwise `pending` is always false. I use `useFormStatus` for reusable leaf components and `useActionState`'s `isPending` when the component that owns the action also renders the UI that depends on it.

## Explanation
### Correct usage

```tsx
"use client";
import { useFormStatus } from "react-dom";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();                // reads parent <form>
  return <button type="submit" disabled={pending} aria-disabled={pending}>
    {pending ? "Saving…" : children}
  </button>;
}

export function ProfileForm({ save }: { save: (fd: FormData) => Promise<void> }) {
  return (
    <form action={save}>
      <input name="name" />
      <SubmitButton>Save</SubmitButton>               {/* child of the form */}
    </form>
  );
}
```

### The common bug

```tsx
function BadForm({ save }: Props) {
  const { pending } = useFormStatus();                // same component renders the form: always false
  return <form action={save}><button disabled={pending}>Save</button></form>;
}
```

### Returned fields

| Field | Meaning |
|---|---|
| `pending` | true while the parent form's Action is running |
| `data` | the `FormData` being submitted (null when idle) |
| `method` | `"get"` or `"post"` |
| `action` | the function (or URL) being run |

`data` is useful for optimistic UI, such as showing the submitted text immediately.

### `useFormStatus` vs `useActionState`

| | `useFormStatus` | `useActionState` |
|---|---|---|
| Where | any descendant of the form | the component that defines the action |
| Gives | pending, data, method | state returned by action, `isPending` |
| Typical use | reusable submit button, spinner | validation errors, results |
| Needs props | no | passes through props |

They compose well: `useActionState` for the result, `useFormStatus` in the button.

### Notes
- Works with function actions (`action={fn}`), including Server Actions; a plain string URL action doesn't produce pending state in the same way.
- It only reflects submissions of that form, not other forms on the page.
- Accessibility: use `aria-disabled` or keep focus management in mind when disabling the focused submit button; announcing status via `role="status"` helps screen readers.
- SSR/hydration: before hydration, forms with Server Actions submit natively; pending state appears once hydrated.

## Follow-ups
- **Can you disable all fields while pending?** — Wrap them in `<fieldset disabled={pending}>` inside a child component that calls `useFormStatus`.
- **Does it work with `onSubmit`?** — No; it's for `action`.

## Common Mistakes
- Calling it in the form's own component.
- Using it with `onSubmit` handlers.

## Tips
- Mention the "child of the form" rule up front; it's the gotcha interviewers test.
