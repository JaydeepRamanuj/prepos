---
title: "Typing React props, children and events correctly"
level: medium
type: concept
tags: [react-typescript, props, children, events, ComponentProps, ReactNode]
related: [typescript/typing-hooks-refs-context, typescript/utility-types, react/children-slots]
---

## Question
How do you type component props, `children`, event handlers and wrapper components that extend native elements? What are the right types for `children`, `onChange`, and passing through DOM props?

## Interview Answer
I type props with a `type` or `interface` and let the function component's return type be inferred; I avoid `React.FC` because it adds nothing in current React types and hides generics. `children` is typed `React.ReactNode` (anything renderable), or `ReactElement` when only elements are allowed, or a function for render props. Event handlers use React's synthetic event types, such as `React.ChangeEvent<HTMLInputElement>` or the handler alias `React.ChangeEventHandler<HTMLInputElement>`, and the generic parameter is the element the handler is attached to. For components that wrap native elements, I extend `React.ComponentProps<"button">` (or `ComponentPropsWithoutRef` when handling refs separately) and spread the rest onto the element, so every native attribute works with correct types. In React 19, `ref` is a regular prop and is already included in `ComponentProps`.

## Explanation
### Basic props and children

```tsx
import type { ReactNode } from "react";

type CardProps = {
  title: string;
  footer?: ReactNode;          // optional slot
  children: ReactNode;
};

function Card({ title, footer, children }: CardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
      {footer}
    </section>
  );
}
```

`ReactNode` includes strings, numbers, elements, fragments, arrays, `null`, `undefined`, booleans and portals. `ReactElement` is just JSX elements; `JSX.Element` is the result type of JSX expressions.

### Function children (render props)

```tsx
type ListProps<T> = { items: T[]; children: (item: T, index: number) => ReactNode };
```

### Events

```tsx
function Search() {
  const [q, setQ] = useState("");

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); };
  const onKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") submit(q);
  };

  return (
    <form onSubmit={onSubmit}>
      <input value={q} onChange={onChange} onKeyDown={onKey} />
      <button onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.blur()}>Go</button>
    </form>
  );
}
```

Inline handlers infer their event types from context, so annotate only when extracting the handler. `e.target` is typed as `EventTarget & HTMLInputElement` in `ChangeEvent<HTMLInputElement>`, while `e.currentTarget` is the element the handler is attached to (reliable); `e.target` can be a child in bubbling events.

### Props that mirror a native element

```tsx
type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
};

function Button({ variant = "primary", loading, children, disabled, ...rest }: ButtonProps) {
  return (
    <button data-variant={variant} disabled={disabled || loading} {...rest}>
      {loading ? "…" : children}
    </button>
  );
}

<Button type="submit" onClick={(e) => e.preventDefault()} aria-label="Save" variant="ghost" />
```

Alternatives: `React.ComponentPropsWithoutRef<"button">` (excludes `ref`, for `forwardRef` code), `JSX.IntrinsicElements["button"]`, or `React.HTMLAttributes<HTMLButtonElement>` (excludes element-specific attrs like `type`). To wrap another component: `React.ComponentProps<typeof Other>`.

### Omitting conflicting props

```tsx
type InputProps = Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;     // simpler API than the raw event
};
```

### Discriminated props

```tsx
type LinkProps =
  | ({ href: string } & Omit<React.ComponentProps<"a">, "href">)
  | ({ onClick: () => void; href?: undefined } & Omit<React.ComponentProps<"button">, "onClick">);
```

### Style and CSS variables

```tsx
const style = { "--accent": "tomato" } as React.CSSProperties;
```

### Things to avoid
- `React.FC` (implicit children in old versions; no generics) – not wrong, just unnecessary.
- `any` events (`e: any`).
- `props: object`.
- `JSX.Element[]` for children (use `ReactNode`).
- Spreading unknown props onto DOM elements without a type that allows them.

## Follow-ups
- **`ReactNode` vs `ReactElement`?** — Node is anything renderable; element is a JSX element only.
- **How do I type `onChange` for a select?** — `React.ChangeEvent<HTMLSelectElement>`.

## Common Mistakes
- Using `HTMLAttributes` and losing `type`/`disabled`.
- Typing children as `JSX.Element` and breaking strings or arrays.

## Tips
- Say `ComponentProps<"button">` and `ReactNode`; they're the two most useful types.
