---
title: "Type a polymorphic component with an `as` prop"
level: advanced
type: implement
tags: [react-typescript, polymorphic, as-prop, generics, ComponentProps, asChild]
related: [typescript/generic-components, typescript/typing-props-children-events, react/headless-components]
---

## Question
Implement a `Box` (or `Text`) component with an `as` prop so that `<Box as="a" href="/x">` accepts anchor props, `<Box as="button" type="submit">` accepts button props, `<Box as={Link} href="/y">` works with custom components, invalid combinations like `<Box as="div" href="/x">` are compile errors, and the default element is `div`.

## Clues
- The element type is a generic parameter `C extends React.ElementType`.
- Props are the component's own props plus the props of `C`, with own props taking precedence.
- `React.ComponentPropsWithoutRef<C>` gives the target's props; `Omit` removes conflicts.

## Interview Answer
I make the component generic over the element type, `C extends React.ElementType = "div"`, and define props as `{ as?: C } & OwnProps & Omit<React.ComponentPropsWithoutRef<C>, keyof OwnProps | "as">`. TypeScript infers `C` from the `as` value, so the remaining props are validated against that element or component, and without `as` it defaults to `div`. The implementation renders `const Component = as ?? "div"` and spreads the rest. Omitting the own keys from the native props avoids clashes (for example my `color` prop versus the HTML `color` attribute). In React 19 `ref` is a normal prop, so I use `ComponentProps<C>` (which includes `ref`) instead of the old `forwardRef`-based recipe that required awkward casts. Many libraries prefer an `asChild` slot (Radix) because polymorphic generics are expensive for the compiler.

## Explanation
### Implementation

```tsx
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type OwnProps<C extends ElementType> = {
  as?: C;
  size?: "sm" | "md";
  children?: ReactNode;
};

type BoxProps<C extends ElementType> = OwnProps<C> &
  Omit<ComponentPropsWithoutRef<C>, keyof OwnProps<C>>;

export function Box<C extends ElementType = "div">({ as, size = "md", children, ...rest }: BoxProps<C>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component data-size={size} {...rest}>
      {children}
    </Component>
  );
}
```

### Usage

```tsx
<Box>plain div</Box>
<Box as="a" href="/docs" target="_blank">link</Box>               // anchor props OK
<Box as="button" type="submit" onClick={(e) => e.currentTarget.blur()}>go</Box>   // e: MouseEvent<HTMLButtonElement>
<Box as={Link} href="/y" prefetch={false}>next link</Box>          // custom component props

// <Box as="div" href="/x" />        // error: 'href' does not exist on div props
// <Box as="a" disabled />        // error: 'disabled' does not exist on anchor props
```

### Why `Omit<…, keyof OwnProps>`
If a native element has a property with the same name as your own prop (`size` exists on `<input>`), the intersection would merge both types. Omitting your own keys means yours win, and the rest are the target's.

### Handling refs
`ComponentPropsWithoutRef<C>` drops `ref`. In React 19 add it via the ref prop:

```tsx
type BoxProps<C extends ElementType> = OwnProps<C> &
  Omit<ComponentProps<C>, keyof OwnProps<C>>;     // ComponentProps includes `ref` for the target
```

Pre-19, the usual solution was `forwardRef` with a cast to preserve the generic signature (a ~10-line `PolymorphicRef` helper).

### Why the implementation uses `ElementType` for the local variable
The rendering line is where TypeScript can't prove the spread is valid for an arbitrary `C`. Annotating `Component` as `ElementType` is a deliberate, local loosening; the public signature stays precise.

### `asChild` alternative

```tsx
import { Slot } from "@radix-ui/react-slot";

function Button({ asChild, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp {...props} />;
}

<Button asChild><a href="/x">Looks like a button</a></Button>     // merges props into the child
```

- Simpler types (one element type per component).
- Works with any child component.
- Cost: runtime cloning via `Slot`.

### Trade-offs

| `as` prop | `asChild` |
|---|---|
| Type-safe element props through generics | Props typed for the default element only |
| Compiler cost grows with unions of elements | cheap |
| Can't easily compose two polymorphic wrappers | composes well |
| Familiar API (Chakra, Mantine, styled-components) | Radix/shadcn style |

### Performance notes
Highly generic `ElementType` unions are heavy for the type checker ("Expression produces a union type that is too complex"). Restrict allowed elements if needed: `C extends "div" | "a" | "button"`.

### Testing types

```tsx
// @ts-expect-error: href is not valid on div
<Box as="div" href="/x" />
```

Use `@ts-expect-error` lines in a type test file to lock in the behaviour.

## Follow-ups
- **Why not use `React.ElementType<any>`?** — It disables prop checking for `C`.
- **How does this interact with `className` merging?** — Add `className` to own props and merge with `clsx`/`cn`.

## Common Mistakes
- Intersecting props without `Omit`, producing impossible merged types.
- Forgetting the default type parameter.

## Tips
- Mention the `asChild` alternative and the compile-time cost; it shows judgment, not just cleverness.
