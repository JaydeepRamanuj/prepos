---
title: "Build a generic List/Select component with correct inference"
level: hard
type: implement
tags: [react-typescript, generic-components, inference, forwardRef, select]
related: [typescript/generic-functions-constraints, typescript/typing-props-children-events, react/render-props-hocs]
---

## Question
Write a generic `<Select<T>>` component that accepts `options: T[]`, a `getLabel` and `getValue`, and an `onChange(option: T)` callback typed with the same `T`. Also write a generic `List<T>` with a render prop. TypeScript should infer `T` from `options`, and wrong callback types should be errors.

```tsx
<Select
  options={users}
  getLabel={(u) => u.name}
  getValue={(u) => u.id}
  value={selected}
  onChange={(u) => setSelected(u)}
/>
```

## Clues
- A function component can have type parameters: `function Select<T>(props: SelectProps<T>)`.
- Inference works from props like `options`; callbacks then get contextual types.
- `forwardRef` loses generics; React 19 `ref` as a prop avoids the problem.

## Interview Answer
I declare the component as a generic function: `function Select<T>({ options, getLabel, getValue, value, onChange }: SelectProps<T>)`. TypeScript infers `T` from the `options` array at the call site, and the other props use `T` so `getLabel` and `onChange` receive typed arguments without annotations. The `value`/`onChange` pair keeps the option type consistent, and I constrain `getValue` to return `string | number` since it's used as the key and DOM value. Because `React.FC` and old `forwardRef` can't express generics, I use plain functions, and in React 19 I add `ref` as a normal prop. For the `.tsx` generic arrow function syntax, I write `<T,>` to avoid ambiguity with JSX. The result gives correct autocomplete and compile errors when the callback or value types don't match the options.

## Explanation
### Select

```tsx
import { useId } from "react";

type SelectProps<T> = {
  options: readonly T[];
  value: T | null;
  onChange: (option: T) => void;
  getLabel: (option: T) => string;
  getValue: (option: T) => string | number;
  placeholder?: string;
};

export function Select<T>({ options, value, onChange, getLabel, getValue, placeholder }: SelectProps<T>) {
  const id = useId();
  return (
    <select
      id={id}
      value={value === null ? "" : String(getValue(value))}
      onChange={(e) => {
        const picked = options.find((o) => String(getValue(o)) === e.target.value);
        if (picked !== undefined) onChange(picked);
      }}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => (
        <option key={getValue(o)} value={String(getValue(o))}>{getLabel(o)}</option>
      ))}
    </select>
  );
}
```

### Usage and inference

```tsx
type User = { id: number; name: string };
const users: User[] = [{ id: 1, name: "Asha" }, { id: 2, name: "Ravi" }];

function Demo() {
  const [selected, setSelected] = useState<User | null>(null);
  return (
    <Select
      options={users}                 // T inferred as User
      value={selected}
      getLabel={(u) => u.name}        // u: User
      getValue={(u) => u.id}
      onChange={setSelected}          // (option: User) => void is compatible with Dispatch<SetStateAction<User | null>>
    />
  );
}

// <Select options={users} value={selected} getLabel={(u) => u.title} … />   // error: 'title' does not exist on User
// <Select options={users} value={42} … />                                    // error: number is not User | null
```

### Generic List with a render prop

```tsx
type ListProps<T> = {
  items: readonly T[];
  keyOf: (item: T) => React.Key;
  children: (item: T, index: number) => React.ReactNode;
  empty?: React.ReactNode;
};

export function List<T>({ items, keyOf, children, empty = null }: ListProps<T>) {
  if (items.length === 0) return <>{empty}</>;
  return <ul>{items.map((item, i) => <li key={keyOf(item)}>{children(item, i)}</li>)}</ul>;
}

<List items={users} keyOf={(u) => u.id}>{(u) => <strong>{u.name}</strong>}</List>
```

### Generic arrow function in TSX

```tsx
const Row = <T,>({ item }: { item: T }) => <div>{String(item)}</div>;     // <T,> disambiguates from JSX
const Row2 = <T extends unknown>({ item }: { item: T }) => <div>{String(item)}</div>;
```

### Exposing a ref (React 19)

```tsx
type SelectProps<T> = { /* … */ ref?: React.Ref<HTMLSelectElement> };
export function Select<T>({ ref, ...rest }: SelectProps<T>) { /* <select ref={ref} … /> */ }
```

Before React 19: `forwardRef` returns a non-generic component; the workaround is a cast to restore generics:

```tsx
export const Select = forwardRef(SelectInner) as <T>(p: SelectProps<T> & { ref?: React.Ref<HTMLSelectElement> }) => ReturnType<typeof SelectInner>;
```

### Design notes
- **Constraints** when you need structure: `T extends { id: string }` lets you drop `getValue`.
- **Controlled generic values**: use `T | null` for "nothing selected".
- **Discriminated unions of props** (single vs multi-select) with generics: `{ multiple: true; value: T[]; onChange(v: T[]): void } | { multiple?: false; value: T | null; … }`.
- **Inference tips**: if inference fails (e.g. `options={[]}`), pass `<Select<User> … />` explicitly.
- **Performance**: generic components are erased at runtime; there is no cost.

## Follow-ups
- **Why `readonly T[]` for `options`?** — Accepts both mutable and readonly arrays and signals that the component won't mutate them.
- **Why not `T extends object`?** — Primitives (strings) are valid options too; add constraints only when needed.

## Common Mistakes
- Typing options as `any[]` or `unknown[]` and losing callback types.
- Using `forwardRef` and silently losing generics.

## Tips
- Show that the compile errors appear at the call site; that's the point of the generics.
