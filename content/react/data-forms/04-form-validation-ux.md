---
title: "Design form validation: when to validate, where to show errors, and how to stay accessible"
level: medium
type: design
tags: [forms, validation, accessibility, zod, ux]
related: [react/use-action-state, react/forms-controlled-inputs, state/forms-zod-react-hook-form, html-css/forms-accessibility]
---

## Question
How would you design validation for a signup form? Cover timing (on change, blur, submit), client versus server validation, error display, accessibility, and sharing schemas.

## Interview Answer
I validate on the server always, because client checks can be bypassed, and on the client for fast feedback. For timing, I avoid showing errors while the user is still typing: validate on blur for the first time, then on change after a field has been touched, and validate everything on submit while moving focus to the first invalid field. Errors appear next to the field in text, not only colour, linked with `aria-describedby`, with `aria-invalid="true"`, and a summary `role="alert"` or focus on the first error for screen readers. I define one schema, for example with Zod, and reuse it in the client and the server so rules can't drift. For async rules like "email taken", I debounce the check and still re-verify on the server. I preserve user input on failure and use native constraints (`type="email"`, `required`, `autocomplete`) as the baseline.

## Explanation
### Timing strategy

| Moment | Behaviour | Why |
|---|---|---|
| While typing (first time) | no error | don't scold users mid-entry |
| On blur | validate the field | feedback when they leave it |
| After first error | validate on change | error clears as soon as it's fixed |
| On submit | validate all, focus first invalid | catches untouched fields |
| Server response | map field errors back | server is the source of truth |

Exceptions: password strength meters and character counters can be live.

### Shared schema

```ts
// schema.ts
import { z } from "zod";
export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});
export type Signup = z.infer<typeof signupSchema>;
```

```tsx
// Client (React Hook Form)
const { register, handleSubmit, formState: { errors } } = useForm<Signup>({
  resolver: zodResolver(signupSchema),
  mode: "onTouched",                        // blur first, then change
});
```

```ts
// Server Action / route handler
const parsed = signupSchema.safeParse(Object.fromEntries(formData));
if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
```

### Accessible error markup

```tsx
<label htmlFor="email">Email</label>
<input
  id="email" type="email" autoComplete="email"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? "email-error" : undefined}
  {...register("email")}
/>
{errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}
```

Checklist:
1. Programmatic labels (`<label for>`), not placeholders as labels.
2. Errors are text, not only red borders (colour contrast ≥ 4.5:1).
3. `aria-invalid` and `aria-describedby` link errors to inputs.
4. On failed submit, focus the first invalid field or an error summary with links.
5. Keep `type`, `autocomplete`, `inputmode` correct for mobile keyboards and password managers.
6. Don't disable the submit button as the only way to communicate errors; explain what's wrong.
7. Preserve typed values after server errors.

### Async and cross-field rules
- Debounce uniqueness checks and handle races (abort stale requests).
- Cross-field validation (password match, date ranges) belongs in the schema's `refine`/`superRefine` and attaches the error to the relevant field via `path`.
- Server-only rules (rate limits, duplicate accounts) return field-level errors in the same shape.

### Security
Never trust client validation; sanitise/escape on output; rate-limit; avoid revealing whether an email exists on login forms.

## Follow-ups
- **Native validation vs custom?** — Use native constraints as a baseline (`required`, `pattern`) and `noValidate` + custom messages when you need consistent UX; `setCustomValidity` for the Constraint Validation API.
- **How do you test it?** — Schema unit tests plus component tests with Testing Library asserting accessible errors.

## Common Mistakes
- Validating only on the client.
- Showing "required" errors the moment a user focuses a field.
- Error messages only in colour or in a toast that disappears.

## Tips
- Mention "one schema, two places" and the blur-then-change strategy.
