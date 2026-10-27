---
title: "Build a form with useActionState and form Actions"
level: hard
type: implement
tags: [useActionState, actions, forms, react-19, validation]
related: [react/use-optimistic, react/use-form-status, react/react-18-to-19-changes, nextjs/form-with-use-action-state]
---

## Question
Implement a signup form with `useActionState`: it should validate on the server action, show field errors without losing what the user typed, disable the button while pending, and work before JavaScript loads if rendered by a framework supporting progressive enhancement.

```tsx
const [state, formAction, isPending] = useActionState(signup, initialState);
<form action={formAction}>…</form>
```

## Clues
- The action receives the previous state as the first argument and `FormData` as the second.
- React 19 resets uncontrolled form fields after a successful Action; return submitted values to restore them.
- The third return value tells you whether the action is running.

## Interview Answer
`useActionState(action, initialState)` returns `[state, formAction, isPending]`. I pass `formAction` to `<form action>`; when the form submits React runs my function as a transition with `(previousState, formData)` and stores whatever it returns as the new state, so validation errors, success messages and echoed values come back as plain data without extra `useState` calls. `isPending` replaces manual loading flags. Because React resets uncontrolled inputs after the action, I return the submitted values and use `defaultValue` so users don't lose input on errors. When the action is a framework Server Action, the form works without JavaScript and hydrates later (progressive enhancement). Actions are queued sequentially, and thrown errors go to the nearest error boundary, so expected failures should be returned as state.

## Explanation
### Implementation

```tsx
"use client";
import { useActionState } from "react";
import { signup } from "./actions";            // a Server Action: "use server"

type State = {
  ok: boolean;
  errors: Partial<Record<"email" | "password", string>>;
  values: { email: string };
};
const initialState: State = { ok: false, errors: {}, values: { email: "" } };

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, initialState);

  return (
    <form action={formAction} noValidate>
      <label>
        Email
        <input name="email" type="email" defaultValue={state.values.email}
               aria-invalid={!!state.errors.email} aria-describedby="email-err" />
      </label>
      {state.errors.email && <p id="email-err" role="alert">{state.errors.email}</p>}

      <label>
        Password
        <input name="password" type="password" aria-invalid={!!state.errors.password} />
      </label>
      {state.errors.password && <p role="alert">{state.errors.password}</p>}

      <button disabled={isPending}>{isPending ? "Creating…" : "Sign up"}</button>
      {state.ok && <p role="status">Account created!</p>}
    </form>
  );
}
```

```ts
// actions.ts
"use server";
export async function signup(prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const errors: State["errors"] = {};
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email";
  if (password.length < 8) errors.password = "Use at least 8 characters";
  if (Object.keys(errors).length) return { ok: false, errors, values: { email } };

  await createUser(email, password);
  return { ok: true, errors: {}, values: { email: "" } };
}
```

### What React does
1. Form submit → React calls `signup(prevState, formData)` inside a transition.
2. `isPending` is true until the promise settles.
3. Returned value becomes `state`; the component re-renders.
4. After the Action, React resets uncontrolled fields (`form.reset()`), hence `defaultValue={state.values.email}` to repopulate. Passwords should not be echoed back.

### Notes
- **Validate on the server even if the client validates too**; client code can be bypassed.
- **Sequential queue:** calling the action multiple times runs them in order.
- **Client-only usage:** the action can be a regular async function in a client component; progressive enhancement requires a Server Action (or a permalink argument as the third parameter of `useActionState` in some frameworks).
- **Redirects:** in Next.js call `redirect()` inside the Server Action after success.
- **Security:** Server Actions are public HTTP endpoints; authenticate and authorise inside them.
- **Errors:** return expected errors; unexpected throws reach the error boundary.
- Pair with `useOptimistic` for instant feedback, and `useFormStatus` in nested buttons.

### Compared with the old way
Previously: `useState` for values, errors, loading; `onSubmit` with `preventDefault`; `fetch`; manual resets.

## Follow-ups
- **Why does the input clear after submit?** — React resets uncontrolled form fields after a successful action; use returned state with `defaultValue`.
- **Can the action be cancelled?** — Not directly; pass an `AbortSignal` if needed.

## Common Mistakes
- Forgetting the previous-state first argument.
- Throwing for validation errors.
- Echoing passwords back.

## Tips
- Say "state is whatever the action returns" and show the signature.
