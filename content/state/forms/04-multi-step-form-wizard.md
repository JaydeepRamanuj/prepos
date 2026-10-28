---
title: "Design a multi-step form wizard: state, per-step validation and persistence"
level: hard
type: design
tags: [multi-step-form, wizard, zod, react-hook-form, url-state, persistence]
related: [state/forms-zod-react-hook-form, state/zod-server-validation, state/server-vs-client-state]
---

## Question
Design a 3-step checkout/onboarding wizard (Account → Address → Payment). Where should the data live, how do you validate each step, support back/forward navigation and refresh, and submit once at the end? Compare approaches (single form, per-step forms with shared store, URL steps).

## Clues
- Decide what is the source of truth across steps.
- Validate a step before advancing, and validate everything again on the server at the end.
- Refresh/back button behaviour is a UX requirement, not an afterthought.

## Interview Answer
I model the wizard as a state machine with an explicit current step and a single accumulated data object. Each step is its own small form with its own Zod schema (a slice of the full schema) so validation happens per step, and "Next" is only enabled after the step validates; the combined schema validates everything again on the server in the final Server Action. The data lives in a place that survives step changes: a Zustand/context store or a single parent `useForm` with `FormProvider`; for refresh resilience I persist drafts in `sessionStorage` (or server-side draft rows) and for navigation I put the step in the URL (`/checkout/address`) so the back button works and steps are linkable, guarding against jumping ahead to steps whose previous data is missing. Sensitive data such as card numbers should never be persisted client-side and should go directly to the payment provider's fields. At the end I submit once, show per-field server errors on the step they belong to, and clear the draft on success.

## Explanation
### Schemas

```ts
export const accountSchema = z.object({ email: z.email(), password: z.string().min(8) });
export const addressSchema = z.object({ line1: z.string().min(1), city: z.string().min(1), postcode: z.string().regex(/^\d{5,6}$/) });
export const paymentSchema = z.object({ cardholder: z.string().min(1) });       // card data handled by provider fields (Stripe Elements)

export const checkoutSchema = z.object({ account: accountSchema, address: addressSchema, payment: paymentSchema });
export type Checkout = z.infer<typeof checkoutSchema>;
```

### Approaches

| Approach | How | Pros | Cons |
|---|---|---|---|
| One big `useForm` + conditional steps | all fields registered; hide steps | simple, one source of values | validation of hidden steps needs `trigger(fieldNames)`; unmounted inputs may drop values (use `shouldUnregister: false`, default) |
| Per-step forms + shared store | each step `useForm` with its schema; on submit merge into store | clean validation, small re-renders | store plumbing |
| Server-driven steps | each step posts a Server Action storing a draft; URL step route | resilient, works without JS, refresh-proof | round trips; server draft model |
| URL-per-step + client store | routes per step reading from a store/persisted draft | back button, deep links | guard logic |

I'd choose per-step forms with a store for rich UX, or server drafts for long, important flows.

### Store + per-step forms

```ts
// wizard-store.ts
export const useWizard = create<{
  data: Partial<Checkout>;
  setStep: <K extends keyof Checkout>(key: K, value: Checkout[K]) => void;
  reset: () => void;
}>()(persist((set) => ({
  data: {},
  setStep: (key, value) => set((s) => ({ data: { ...s.data, [key]: value } })),
  reset: () => set({ data: {} }),
}), { name: "checkout-draft", storage: createJSONStorage(() => sessionStorage), partialize: (s) => ({ data: { account: s.data.account && { email: s.data.account.email }, address: s.data.address } }) }));
```

```tsx
function AddressStep() {
  const router = useRouter();
  const { data, setStep } = useWizard();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: data.address ?? { line1: "", city: "", postcode: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) => { setStep("address", values); router.push("/checkout/payment"); })} noValidate>
      {/* fields */}
      <button type="button" onClick={() => router.back()}>Back</button>
      <button>Continue</button>
    </form>
  );
}
```

Passwords and card data are not persisted (`partialize`), only non-sensitive fields.

### Step guard

```tsx
function PaymentStep() {
  const data = useWizard((s) => s.data);
  if (!data.account || !data.address) return <Redirect to="/checkout/account" />;   // can't skip ahead
  /* … */
}
```

### Final submit

```ts
"use server";
export async function placeOrder(payload: unknown): Promise<Result> {
  const parsed = checkoutSchema.safeParse(payload);                 // re-validate everything on the server
  if (!parsed.success) return { ok: false, errors: z.treeifyError(parsed.error) };   // include which step each error belongs to
  // business rules, payment intent confirmation, create order
}
```

Map server errors to steps (error paths start with `account`, `address`, `payment`) and navigate the user to the first failing step.

### UX details
- Step indicator with `aria-current="step"`, headings per step, focus the step heading on change.
- Preserve data when going back; show a summary before confirming.
- Autosave drafts for long flows (debounced) and offer "resume".
- Disable double-submit; handle network errors with retry.
- Analytics per step and drop-off tracking.
- Mobile: single-column, appropriate input types/`autocomplete`.
- Conditional steps (skip shipping if digital) → derive the step list from data.

### State machine view
Define steps and transitions explicitly (XState or a simple reducer): `idle → account → address → payment → submitting → success|error`, which makes illegal transitions impossible and testable.

### Testing
Unit-test schemas and step-skipping logic; component tests for each step; Playwright E2E for the whole flow including refresh, back and server errors.

## Follow-ups
- **Why not keep everything in component state of the parent?** — Refresh loses it, route-based steps unmount it, and it complicates deep links.
- **Where to store the draft for logged-in users?** — A server-side draft record keyed by user, so it works across devices.

## Common Mistakes
- Validating only at the end.
- Persisting sensitive data in browser storage.
- Letting users deep-link to a step with missing prerequisites.

## Tips
- Say "per-step schema, combined schema on the server, URL as the step".
