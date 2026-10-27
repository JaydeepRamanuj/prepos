---
title: "Dynamic forms with useFieldArray: add/remove rows, keys and re-render control"
level: hard
type: implement
tags: [react-hook-form, useFieldArray, dynamic-forms, useWatch, performance, keys]
related: [state/forms-zod-react-hook-form, react/forms-controlled-inputs, react/index-as-key]
---

## Question
Implement an invoice form with a dynamic list of line items (description, quantity, price) using `useFieldArray`. Rows can be added, removed and reordered; the total updates live; each row validates with Zod; typing in one row should not re-render all rows. Explain keys, `useWatch` vs `watch`, and common pitfalls.

## Clues
- `useFieldArray` provides `fields` with stable ids for React keys.
- Subscribe to totals with `useWatch` in a small component.
- Register nested fields with indexed names like `items.${index}.price`.

## Interview Answer
`useFieldArray({ control, name: "items" })` returns `fields` (each with a generated `id`), plus `append`, `remove`, `insert`, `move`, and `replace`. I render rows with `key={field.id}`, never the index, and register inputs with `register(`items.${index}.qty`)` so RHF tracks them as uncontrolled inputs. Validation lives in a Zod schema (`z.array(itemSchema).min(1)`), and errors are read from `errors.items?.[index]?.qty?.message`. For the live total I use `useWatch({ control, name: "items" })` inside a small `Total` component, so only that component re-renders as the user types, rather than `watch("items")` in the parent, which re-renders the whole form on every keystroke. Each row can be a memoised component receiving `index`, `register` and `remove`, and I use `valueAsNumber` or Zod coercion for numbers. Pitfalls include using the index as a key (state mismatches on removal), not providing complete default objects, and not spreading `field` values properly.

## Explanation
### Schema

```ts
const itemSchema = z.object({
  description: z.string().min(1, "Required"),
  qty: z.number({ error: "Enter a number" }).int().min(1, "At least 1"),
  price: z.number({ error: "Enter a price" }).min(0, "Can't be negative"),
});

export const invoiceSchema = z.object({
  customer: z.string().min(1, "Required"),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});
type InvoiceValues = z.infer<typeof invoiceSchema>;
```

### Form

```tsx
"use client";
import { memo } from "react";
import { useForm, useFieldArray, useWatch, type Control, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export function InvoiceForm() {
  const { control, register, handleSubmit, formState: { errors } } = useForm<InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { customer: "", items: [{ description: "", qty: 1, price: 0 }] },
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: "items" });

  return (
    <form onSubmit={handleSubmit((v) => save(v))} noValidate>
      <input {...register("customer")} placeholder="Customer" aria-invalid={!!errors.customer} />

      <fieldset>
        <legend>Line items</legend>
        {fields.map((field, index) => (
          <Row key={field.id} index={index} register={register} remove={remove} errors={errors} canRemove={fields.length > 1} />
        ))}
        {errors.items?.root && <p role="alert">{errors.items.root.message}</p>}
        {errors.items?.message && <p role="alert">{errors.items.message}</p>}
        <button type="button" onClick={() => append({ description: "", qty: 1, price: 0 })}>Add item</button>
      </fieldset>

      <Total control={control} />
      <button>Save invoice</button>
    </form>
  );
}

const Row = memo(function Row({ index, register, remove, errors, canRemove }: {
  index: number;
  register: UseFormRegister<InvoiceValues>;
  remove: (i: number) => void;
  errors: FieldErrors<InvoiceValues>;
  canRemove: boolean;
}) {
  const e = errors.items?.[index];
  return (
    <div role="group" aria-label={`Item ${index + 1}`}>
      <input {...register(`items.${index}.description`)} placeholder="Description" aria-invalid={!!e?.description} />
      <input {...register(`items.${index}.qty`, { valueAsNumber: true })} type="number" min={1} aria-invalid={!!e?.qty} />
      <input {...register(`items.${index}.price`, { valueAsNumber: true })} type="number" step="0.01" aria-invalid={!!e?.price} />
      {e?.qty && <p role="alert">{e.qty.message}</p>}
      <button type="button" onClick={() => remove(index)} disabled={!canRemove} aria-label={`Remove item ${index + 1}`}>×</button>
    </div>
  );
});

function Total({ control }: { control: Control<InvoiceValues> }) {
  const items = useWatch({ control, name: "items" });                 // only this component re-renders on item changes
  const total = (items ?? []).reduce((sum, i) => sum + (Number(i?.qty) || 0) * (Number(i?.price) || 0), 0);
  return <p aria-live="polite">Total: {total.toFixed(2)}</p>;
}
```

### Keys: why `field.id`
`fields[i].id` is a generated unique id that follows the row through reorder/remove operations (`id` is not part of your data; you can customise the key name with `keyName` in older versions, or avoid an `id` field in your item shape). Using `index` as the key makes React reuse DOM and input state for the wrong row after removal, so values appear in the wrong rows.

### Controlling re-renders
- `register` inputs are uncontrolled; typing doesn't update React state.
- `watch()` in the form component re-renders it on any watched change; `useWatch` scopes the subscription to the calling component.
- Memoise `Row` and pass stable props (`register`, `remove` are stable; `errors` changes only when validation changes).
- For huge lists, combine with virtualisation (`react-window`) while using `useFieldArray` (needs care: unmounted rows still keep values in RHF's store, but `register` must run when rows mount).

### Other field array operations
`insert(index, value)`, `prepend`, `swap`, `move(from, to)` for drag-and-drop, `update(index, value)` (remounts the row; avoid for per-keystroke updates), `replace(newArray)`. After mutations, call `trigger("items")` if you need immediate validation.

### Controlled components in rows

```tsx
<Controller control={control} name={`items.${index}.qty`} render={({ field }) => <QuantityStepper {...field} />} />
```

### Pitfalls
1. Missing complete default objects in `append` leads to uncontrolled→controlled warnings.
2. Don't stack `useFieldArray` calls for the same name.
3. Validation messages for array-level rules live at `errors.items?.root` or `errors.items?.message` depending on version and schema.
4. Nested arrays: names like `groups.${i}.items.${j}.name` with nested `useFieldArray` inside a child component.
5. `reset()` replaces the fields; pass full values.
6. Number inputs: `valueAsNumber` returns `NaN` for empty fields, so Zod `z.number()` rejects it with a message.

## Follow-ups
- **Why not `useState` array?** — You'd re-render the whole form per keystroke and write your own validation, dirty tracking and focus management.
- **How would you drag-and-drop reorder?** — Use `move(from, to)` in a dnd library's `onDragEnd`.

## Common Mistakes
- Index keys.
- `watch("items")` at the top level of a large form.
- Forgetting `valueAsNumber`.

## Tips
- Say "key by `field.id`, subscribe with `useWatch`".
