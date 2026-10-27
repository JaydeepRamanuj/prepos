---
title: "Build a type-safe form with React Hook Form and Zod"
level: medium
type: implement
tags: [react-hook-form, zod, zodResolver, validation, forms, type-inference]
related: [state/zod-server-validation, react/form-validation-ux, react/controlled-vs-uncontrolled]
---

## Question
Build a signup form with React Hook Form and Zod: schema-derived types, field errors, a cross-field rule (password confirmation), async submit with server errors, and accessible error messages. Explain how React Hook Form avoids re-renders.

## Interview Answer
I define one Zod schema as the source of truth, infer the TypeScript type with `z.infer`, and pass the schema to `useForm` through `zodResolver`. `register("email")` connects uncontrolled inputs via refs, so typing doesn't re-render the form; validation runs on the chosen `mode` (`onTouched` is a good default: validate on blur first, then on change). Errors from `formState.errors` are rendered next to inputs and wired with `aria-invalid` and `aria-describedby`. Cross-field rules go in the schema with `.refine`/`superRefine` and a `path` so the error attaches to the right field. On submit, `handleSubmit` runs validation and calls my async handler; server-side field errors are mapped back with `setError`, and a general failure with `setError("root", …)`. `isSubmitting` disables the button. For custom or controlled components such as selects from a UI library, I use `Controller` (or `useController`). I validate again on the server with the same schema.

## Explanation
### Schema and types

```ts
import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().min(2, "Enter your name"),
    email: z.email("Enter a valid email"),                       // Zod 4: top-level string formats
    password: z.string().min(8, "Use at least 8 characters").regex(/\d/, "Include a number"),
    confirm: z.string(),
    terms: z.literal(true, { error: "You must accept the terms" }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export type SignupValues = z.infer<typeof signupSchema>;
```

In Zod 3 you'd write `z.string().email(...)` and `{ errorMap }`/`message` options; in Zod 4 `z.email()` is preferred (the method forms still work but are deprecated) and the error customisation parameter is `error`. Check the version in your project.

### Form

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export function SignupForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "", confirm: "", terms: false as unknown as true },
  });

  const onSubmit = async (values: SignupValues) => {
    const res = await fetch("/api/signup", { method: "POST", body: JSON.stringify(values), headers: { "Content-Type": "application/json" } });
    if (res.status === 409) return setError("email", { message: "That email is already registered" });
    if (!res.ok) return setError("root", { message: "Something went wrong. Try again." });
    // success: redirect
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Name" error={errors.name?.message}>
        {(p) => <input {...p} {...register("name")} autoComplete="name" />}
      </Field>
      <Field label="Email" error={errors.email?.message}>
        {(p) => <input {...p} {...register("email")} type="email" autoComplete="email" />}
      </Field>
      <Field label="Password" error={errors.password?.message}>
        {(p) => <input {...p} {...register("password")} type="password" autoComplete="new-password" />}
      </Field>
      <Field label="Confirm password" error={errors.confirm?.message}>
        {(p) => <input {...p} {...register("confirm")} type="password" autoComplete="new-password" />}
      </Field>
      <label><input type="checkbox" {...register("terms")} /> I accept the terms</label>
      {errors.terms && <p role="alert">{errors.terms.message}</p>}
      {errors.root && <p role="alert">{errors.root.message}</p>}
      <button disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create account"}</button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": error ? `${id}-err` : undefined })}
      {error && <p id={`${id}-err`} role="alert">{error}</p>}
    </div>
  );
}
```

### Controlled third-party components

```tsx
<Controller
  control={control}
  name="country"
  render={({ field, fieldState }) => (
    <CountrySelect value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
  )}
/>
```

### Why it's fast
- `register` returns `{ name, ref, onChange, onBlur }`; inputs stay uncontrolled and RHF reads values from the DOM refs at validation/submit time.
- Form state is stored in a ref-based store; components subscribe to the slices of `formState` they read (proxy-based subscription), so typing in one field doesn't re-render the form unless `watch`/`errors` for that field changed.
- `watch("field")` re-renders the host component on every change; prefer `useWatch({ name })` in a small child component, or `getValues` in handlers.

### Useful APIs
`reset(values)` (after save or to load async defaults), `setValue(name, value, { shouldValidate: true })`, `trigger()` (manual validation), `formState.isDirty/dirtyFields/touchedFields`, `useFormContext` for deep trees, `useFieldArray` for lists, `setFocus`, `resetField`.

### Gotchas
- Checkbox + `z.literal(true)` typing requires a default of `false` cast; alternatively `z.boolean().refine((v) => v, "…")`.
- Number inputs return strings; use `valueAsNumber: true` in `register` or `z.coerce.number()`.
- Resolver output types: with `z.coerce` or transforms, input and output types differ; use `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>`.
- Async default values: `defaultValues: async () => fetch…` or `reset` after load.
- Don't mix controlled `value` props with `register` on the same input.

## Follow-ups
- **`mode: "onChange"` vs `"onTouched"`?** — `onChange` validates on every keystroke (noisy); `onTouched` validates on first blur, then on each change.
- **React 19 actions vs RHF?** — Actions suit progressive enhancement and simple forms; RHF excels at complex client validation, dynamic fields and fine-grained subscriptions. They can be combined by calling an action from `handleSubmit`.

## Common Mistakes
- Using `watch()` for everything (re-renders).
- Not mapping server errors back to fields.
- Duplicating validation rules in types and schema.

## Tips
- Mention "uncontrolled inputs + ref-based store" for performance.
