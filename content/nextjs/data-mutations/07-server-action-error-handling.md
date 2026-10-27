---
title: "How should errors be handled in Server Actions: expected vs unexpected, redirect and notFound"
level: hard
type: concept
tags: [server-actions, error-handling, useActionState, redirect, error-boundary, unstable_rethrow]
related: [react/use-action-state, react/error-boundaries, nextjs/loading-error-not-found, nextjs/how-server-actions-work]
---

## Question
A Server Action validates input, writes to the database and redirects. What is the right way to handle validation errors, database failures and the `redirect()` call? Why does a `try/catch` around `redirect` break navigation?

## Clues
- Expected errors are part of normal operation; unexpected ones are bugs or outages.
- `redirect()` and `notFound()` work by throwing special errors.
- Error boundaries catch rendering errors, not everything.

## Interview Answer
I separate two classes. Expected errors, such as validation failures, "email already taken" or a payment decline, are modelled as return values: the action returns `{ ok: false, errors }` and the form reads it with `useActionState`, so the UI shows field messages without throwing. Unexpected errors, like a database outage or a bug, are allowed to throw; in production the error message is sanitised and the nearest `error.tsx` boundary renders a fallback with a retry, and I log them to monitoring on the server. `redirect()` and `notFound()` work by throwing control-flow errors, so I call `redirect()` outside any `try/catch`, usually as the last statement, or re-throw with `unstable_rethrow(error)` in a catch block. I also validate on the server, authorise inside the action, and never rely on client validation.

## Explanation
### Expected errors: return them

```ts
"use server";
import { z } from "zod";

const schema = z.object({ email: z.string().email(), name: z.string().min(2) });

export type State =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string[]>; message?: string; values?: { email: string } };

export async function signup(_prev: State | null, fd: FormData): Promise<State> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors, values: { email: String(fd.get("email") ?? "") } };
  }

  try {
    await db.user.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, fieldErrors: { email: ["Email already registered"] } };   // expected
    }
    throw e;                                                                           // unexpected: let it bubble
  }

  redirect("/welcome");                                                                // outside try/catch
}
```

```tsx
"use client";
const [state, action, pending] = useActionState(signup, null);
<form action={action}>
  …
  {state && !state.ok && state.fieldErrors?.email && <p role="alert">{state.fieldErrors.email[0]}</p>}
</form>
```

### Unexpected errors: throw to an error boundary

```tsx
// app/dashboard/error.tsx
"use client";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert">
      <p>Something went wrong.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

In production the original server error message isn't sent to the client; you get a generic message and a `digest` hash to match against server logs. In development the message is shown. `error.tsx` boundaries catch rendering errors and errors thrown by Server Actions during their render-phase transition, but not errors in event handlers; for handler-invoked actions, catch and set state or call `startTransition(() => { throw e })` to hand it to the boundary.

### Why `redirect` inside `try/catch` fails

```ts
try {
  await save();
  redirect("/done");        // throws NEXT_REDIRECT
} catch (e) {
  return { ok: false };     // swallows the redirect: user stays on the page
}
```

Fixes:
1. Call `redirect()` after the `try/catch`.
2. In a catch that may see framework errors, call `unstable_rethrow(e)` first; it re-throws redirect/notFound/dynamic-API errors and ignores others.

```ts
import { unstable_rethrow } from "next/navigation";
try { await doWork(); } catch (e) { unstable_rethrow(e); log(e); return { ok: false }; }
```

### Related behaviours
- `notFound()` renders the closest `not-found.tsx`; `forbidden()`/`unauthorized()` exist for auth-related responses where enabled.
- Redirect type: `redirect` in an action performs a 303 for POST; `permanentRedirect` uses 308.
- After a mutation, call the revalidation API before `redirect`, since code after a redirect doesn't run.
- Log with context (user id, action name) on the server; never return stack traces or DB messages to users.
- Rate-limit and protect against enumeration ("email already registered" reveals accounts; weigh it for sign-in/reset flows).

### Testing
Unit-test the schema and the action function with `FormData`; e2e test the form for error rendering and redirects.

## Follow-ups
- **Why not throw validation errors?** — They'd hit the error boundary, discarding the form UI and user input.
- **How do I show a toast on failure?** — Return state and render the toast from it, or use `useEffect` on state change.

## Common Mistakes
- Wrapping `redirect()` in `try/catch`.
- Returning raw error messages from the database.
- Relying on client-side validation alone.

## Tips
- Say "expected = return value, unexpected = throw" and mention the redirect pitfall.
