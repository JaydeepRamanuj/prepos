---
title: "Build a sign-up form with a Server Action, Zod validation and useActionState"
level: hard
type: implement
tags: [server-actions, useActionState, zod, forms, validation, useFormStatus]
related: [nextjs/how-server-actions-work, nextjs/server-action-error-handling, react/use-action-state, state/zod-server-validation]
---

## Question
Write a sign-up form (name, email, password) for the App Router:

- Validation happens **on the server** with Zod. Field errors are shown under each input.
- The submit button shows a pending state.
- The form must work before JavaScript loads.
- On success, redirect to `/welcome`.
- If validation fails, the user's typed values must not be wiped.

Give the action file, the schema and the client form component.

## Clues
- The action's signature changes when it's used with `useActionState`. What becomes the first argument?
- Zod's `safeParse` gives you a result object instead of throwing. Return the errors as state; don't throw them.
- React 19 resets uncontrolled form fields after an action completes. How do you put the submitted values back?

## Interview Answer
I put the schema in a shared file, and the action in a `'use server'` file with the signature `(prevState, formData)`, because `useActionState` passes the previous state first. Inside, I `safeParse` the form fields. On failure I *return* a state object with `fieldErrors` and the submitted values, since expected errors should be values, not exceptions. On success I create the user and call `redirect('/welcome')` outside any `try/catch`, because redirect works by throwing. In the client component, `useActionState(signup, initialState)` gives me `[state, formAction, pending]`: I pass `formAction` to `<form action>`, render `state.errors.email` under each field, disable the button with `pending`, and set `defaultValue` from `state.values` so React 19's automatic form reset doesn't clear what the user typed. Because it's a real `<form action>`, it still submits before hydration.

## Explanation
### 1. Schema and state type (shared)

```ts
// app/signup/definitions.ts
import { z } from "zod";

export const SignupSchema = z.object({
  name: z.string().trim().min(2, { error: "Name must be at least 2 characters." }),
  email: z.email({ error: "Enter a valid email." }),
  password: z
    .string()
    .min(8, { error: "At least 8 characters." })
    .regex(/[0-9]/, { error: "Include a number." }),
});

export type SignupFields = z.infer<typeof SignupSchema>;

export type SignupState = {
  errors?: Partial<Record<keyof SignupFields, string[]>>;
  message?: string;
  values?: { name?: string; email?: string }; // never echo the password back
};
```

### 2. The Server Action

```ts
// app/signup/actions.ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { SignupSchema, type SignupState } from "./definitions";
import { createUser, emailExists } from "@/lib/users"; // server-only DAL
import { createSession } from "@/lib/session";

export async function signup(
  _prev: SignupState,      // first arg: previous state (from useActionState)
  formData: FormData,      // second arg: the submitted form
): Promise<SignupState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { name: raw.name, email: raw.email };

  // 1. Validate. safeParse never throws.
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  // 2. Business rules that need the DB
  if (await emailExists(parsed.data.email)) {
    return { errors: { email: ["This email is already registered."] }, values };
  }

  // 3. Mutate. Unexpected failures become a generic message, not a stack trace
  try {
    const user = await createUser(parsed.data); // hashes the password inside
    await createSession(user.id);
  } catch {
    return { message: "Something went wrong. Please try again.", values };
  }

  // 4. redirect() throws a control-flow error, so keep it OUTSIDE try/catch
  redirect("/welcome");
}
```

### 3. The client form

```tsx
// app/signup/signup-form.tsx
"use client";

import { useActionState } from "react";
import { signup } from "./actions";
import type { SignupState } from "./definitions";

const initialState: SignupState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} noValidate>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" defaultValue={state.values?.name} aria-describedby="name-error" />
      <FieldError id="name-error" errors={state.errors?.name} />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" defaultValue={state.values?.email} aria-describedby="email-error" />
      <FieldError id="email-error" errors={state.errors?.email} />

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" aria-describedby="password-error" />
      <FieldError id="password-error" errors={state.errors?.password} />

      {state.message && <p role="alert">{state.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} aria-live="polite">
      {errors.join(" ")}
    </p>
  );
}
```

```tsx
// app/signup/page.tsx — Server Component that renders the client form
import { SignupForm } from "./signup-form";
export default function Page() {
  return <SignupForm />;
}
```

### Why each piece matters
- **`(prevState, formData)` signature.** `useActionState` changes the action's signature. Forgetting the first parameter means `formData` is actually the previous state, and `.get` is undefined.
- **Return, don't throw, for validation.** Thrown errors go to `error.tsx` and lose the form. Returned values render inline.
- **`z.flattenError(error).fieldErrors`** gives `{ email: ["..."], ... }`. In Zod 3 this was `error.flatten().fieldErrors`, which still works in Zod 4 but is deprecated.
- **`defaultValue` from state.** React 19 resets uncontrolled fields after the action finishes. Re-seeding `defaultValue` keeps the typed values. Never echo the password.
- **`noValidate`** turns off the browser's validation bubbles so the server is the source of truth. Remove it if you also want HTML `required` hints. Client checks are UX. The server check is the security.
- **`pending`** comes straight from `useActionState`. Alternatively, a child `<SubmitButton>` can read `useFormStatus().pending`, which must be called in a component *inside* the form.

### Sharing the schema with client-side validation
Since the schema has no server-only imports, you can also run it in the client (for example with React Hook Form's `zodResolver`) for instant feedback. Keep the server `safeParse` anyway, because a direct POST skips the client entirely.

### Before React 19
In Next 14 this was `useFormState` from `react-dom`. It had no `pending` value, so you needed `useFormStatus` in a child component. In React 19 it was renamed `useActionState` and moved to `react`.

## Follow-ups
- **How would you show a success toast without redirecting?** — Return `{ ok: true }` in state and react to it in an effect, or call `toast()` after an awaited action in a transition. Keep the toast as a side effect, not render logic.
- **How do you reset the form after success?** — React 19 resets uncontrolled fields automatically after the action completes. For full control, change a `key` on the form from the returned state.
- **What about file uploads?** — `formData.get('avatar')` returns a `File`. Mind the 1 MB `serverActions.bodySizeLimit`, or upload directly from the browser to storage and send only the URL.

## Common Mistakes
- Throwing on validation failure instead of returning errors.
- Wrapping `redirect()` in `try/catch`, which catches the redirect and leaves the user on the form.
- Trusting client-side validation alone.
- Returning the created user record (with password hash) as action state.
- Calling `useFormStatus` in the same component that renders the `<form>`, where it always reports not pending.

## Tips
- Write the action in this order: **parse, check, mutate, redirect.** It is easy to remember and covers the security points.
- Mention the accessibility details (`aria-describedby`, `aria-live`). It is a cheap way to stand out.
