---
title: "Share one Zod schema between client and server: Server Actions, parsing FormData and field errors"
level: hard
type: design
tags: [zod, server-validation, server-actions, formdata, safeParse, trust-boundaries]
related: [state/forms-zod-react-hook-form, react/use-action-state, nextjs/server-actions-are-public-endpoints]
---

## Question
Design validation so the same rules run in the browser (instant feedback) and on the server (security). Show how to parse `FormData` in a Server Action, return typed field errors for `useActionState`, handle coercion (numbers, checkboxes, dates), and keep server-only rules separate.

## Clues
- Client validation can be bypassed; the server must always validate.
- `FormData` values are strings or Files; you must coerce.
- Return errors as data, not exceptions.

## Interview Answer
I define the schema in a shared module and use it in two places: the client form (via a resolver or a `safeParse` call for fast feedback) and the Server Action, where it is the authoritative validation. In the action I convert `FormData` to a plain object (`Object.fromEntries`, with care for repeated keys via `getAll`), parse with `schema.safeParse`, and if it fails return a serialisable error shape such as `z.flattenError(error).fieldErrors` along with the submitted values so the form can repopulate; if it succeeds I proceed with typed data. Coercion handles strings: `z.coerce.number()`, checkbox presence via `z.preprocess` or `z.stringbool()`, dates with `z.coerce.date()`. Rules that need the database or session (unique email, permissions) live only on the server, added after parsing, and their failures are returned as field errors too. This yields one source of truth for shape and type, with security enforced server-side.

## Explanation
### Shared schema

```ts
// lib/schemas/profile.ts: safe to import in client and server (no server-only imports)
import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  age: z.coerce.number().int().min(13, "You must be at least 13").max(120),
  newsletter: z.stringbool().default(false),          // "on" | "true" | "1" → true; absent → default
  birthday: z.coerce.date().optional(),
  tags: z.array(z.string().trim().min(1)).max(5).default([]),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type Profile = z.output<typeof profileSchema>;
```

(Zod 3 equivalents: `z.preprocess` for checkboxes, `error.flatten()` for errors.)

### Server Action

```ts
"use server";
import { profileSchema } from "@/lib/schemas/profile";
import { z } from "zod";
import { verifySession } from "@/lib/dal";

export type ProfileState =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string; values?: Record<string, unknown> };

export async function updateProfile(_prev: ProfileState | null, formData: FormData): Promise<ProfileState> {
  const { userId } = await verifySession();                         // authenticate first

  const raw = {
    ...Object.fromEntries(formData),                                 // loses duplicate keys
    tags: formData.getAll("tags"),                                   // repeated fields
    newsletter: formData.get("newsletter") ?? undefined,
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,         // Zod 3: parsed.error.flatten().fieldErrors
      values: raw,                                                    // repopulate (omit secrets)
    };
  }

  // Server-only rules (DB / permissions) after structural validation
  const taken = await db.user.findFirst({ where: { name: parsed.data.name, NOT: { id: userId } } });
  if (taken) return { ok: false, fieldErrors: { name: ["That name is taken"] }, values: raw };

  await db.user.update({ where: { id: userId }, data: parsed.data });
  updateTag(`user-${userId}`);
  return { ok: true };
}
```

Files in `FormData` are `File` objects; validate with `z.instanceof(File)` and `.refine` on size/type, and enforce limits again at the storage layer (and `serverActions.bodySizeLimit`).

### Client usage

```tsx
"use client";
const [state, action, pending] = useActionState(updateProfile, null);

<form action={action}>
  <input name="name" defaultValue={state && !state.ok ? String(state.values?.name ?? "") : ""} aria-invalid={!!(state && !state.ok && state.fieldErrors?.name)} />
  {state && !state.ok && state.fieldErrors?.name && <p role="alert">{state.fieldErrors.name[0]}</p>}
  …
</form>
```

For instant feedback, validate on blur with `profileSchema.shape.name.safeParse(value)` or run the full RHF resolver, then still submit to the same action.

### Principles
1. **Never trust the client**: validation in the action is mandatory; client validation is UX.
2. **Parse, don't validate**: use the parsed output (`parsed.data`), not the raw input, downstream.
3. **Return errors as data**: validation failures are expected; reserve throws for bugs.
4. **Strip unknown keys**: `z.object` strips unknown keys by default (`z.strictObject` rejects them) to prevent mass-assignment (`role: "admin"` in the form).
5. **Separate layers**: structural validation (schema) vs business rules (DB, permissions); the latter never ship to the client.
6. **Consistent error shape** across actions and API routes (`fieldErrors`, `formError`).
7. **Normalise** input in the schema (`trim`, `toLowerCase`) so stored data is consistent.
8. **Limit sizes** (strings, arrays, files) to prevent abuse.
9. **Avoid leaking** which part failed in security-sensitive flows (login/reset).

### Coercion cheat sheet

| Input | Schema |
|---|---|
| number input (string) | `z.coerce.number()` (beware `""` → 0; use `z.preprocess` to map `""` to `undefined`) |
| checkbox (absent when unchecked) | `z.stringbool()` / `z.preprocess((v) => v === "on", z.boolean())` |
| date | `z.coerce.date()` or `z.iso.date()` |
| repeated key | `formData.getAll(name)` + `z.array()` |
| JSON string | `z.string().transform(JSON.parse)` guarded with try/catch (or `z.preprocess`) |
| empty string → undefined | `z.preprocess((v) => (v === "" ? undefined : v), z.string().optional())` |

### With API routes
Same schema in a Route Handler: `const result = schema.safeParse(await req.json()); if (!result.success) return Response.json({ errors: z.flattenError(result.error) }, { status: 422 });`.

### Testing
Unit-test the schema with valid/invalid/edge inputs; test the action by calling it with constructed `FormData`.

## Follow-ups
- **Why not trust TypeScript types from the form?** — Types vanish at runtime; requests can contain anything.
- **`safeParse` vs `parse`?** — `safeParse` returns a result for expected failures; `parse` throws.

## Common Mistakes
- Casting `Object.fromEntries(formData) as Profile`.
- Coercing `""` to `0` silently.
- Allowing extra fields to flow into DB updates.

## Tips
- State "shared shape, server-only rules" and show `safeParse` returning data, not errors thrown.
