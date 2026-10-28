---
title: "Design the API of a reusable component: props, composition, accessibility and escape hatches"
level: hard
type: design
tags: [design-system, component-api, composition, variants, accessibility, polymorphism]
related: [react/compound-components, react/headless-components, typescript/polymorphic-as-prop, html-css/class-merging-cva]
---

## Question
You're designing a `Button` and a `Dialog` for the company design system used by 30 teams. What principles guide the component APIs? Discuss variants vs composition, prop naming, defaults, accessibility, extensibility and how to avoid breaking consumers.

## Clues
- Public API is a contract: every prop is a maintenance cost.
- Prefer composition for structure and props for small, closed variations.
- Accessibility should be the default, not an option.

## Interview Answer
I design for the common case with minimal props and an escape hatch. For small closed variations (variant, size, disabled, loading) I use props with a constrained set of string literals and sensible defaults; for structure (header, body, footer, icons) I use composition (compound components or children/slots) rather than a growing list of `titleIcon`, `showFooter` props. Components forward refs and spread native element props (`ComponentProps<"button">`) so consumers can add `aria-*`, `data-*` and event handlers, and merge `className`/`style` rather than replacing them. Accessibility is built in: correct semantic element, keyboard behaviour, focus management and labelling requirements enforced through types (for example icon-only buttons require `aria-label`). I add controlled and uncontrolled modes for stateful components, keep the API consistent across the system (same names for `size`, `variant`, `onOpenChange`), and treat the public surface as semver: additive changes in minors, deprecation with codemods before removal in majors.

## Explanation
### Principles

1. **Small surface, strong defaults**: `<Button>Save</Button>` works; options are additive.
2. **Closed variants via unions**, not free-form strings or booleans pile-up: `variant: "primary" | "secondary" | "ghost" | "danger"`; avoid `isPrimary`, `isDanger` flags that can conflict.
3. **Composition over configuration** for structure:

```tsx
// Configuration explosion
<Dialog title="Delete" description="…" showCloseButton footerButtons={[…]} icon="warning" />

// Composition
<Dialog open={open} onOpenChange={setOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Delete project?</Dialog.Title>
      <Dialog.Description>This can't be undone.</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="danger" onClick={confirm}>Delete</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog>
```

4. **Native element parity**: extend the element's props, forward `ref` (React 19: ref as prop), spread `...rest` last (or intentionally first for protected props).
5. **Style extensibility** with guardrails: accept `className` merged via `cn`/`tailwind-merge`; avoid exposing every CSS property as a prop. Provide tokens/slots for deeper customisation (`classNames={{ icon: "…" }}`) only when needed.
6. **Accessible by default and enforced by types**:

```tsx
type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
} & ({ children: React.ReactNode } | { "aria-label": string });    // icon-only buttons must be labelled
```

   Set `type="button"` by default to avoid accidental form submits; `loading` sets `aria-busy` and disables interaction while keeping layout stable.
7. **Controlled/uncontrolled**: `open`/`defaultOpen`/`onOpenChange`; one convention (`onXChange(value)`), not mixing `onChange(event)` and `onChange(value)` across components.
8. **Consistent vocabulary**: same prop names across components (`size`, `variant`, `disabled`, `invalid`, `asChild`/`as`).
9. **Polymorphism where valuable**: `asChild` slot (Radix) so `<Button asChild><Link href="/">Home</Link></Button>` renders a link with button styling.
10. **Don't leak implementation**: avoid exposing third-party library types in your public API; wrapping Radix/React Aria lets you swap internals.
11. **State via data attributes** (`data-state="open"`, `data-disabled`) so consumers can style states.
12. **SSR/RSC friendly**: mark client components appropriately; avoid accessing `window` during render; named exports per component for tree-shaking.

### Anti-patterns
- Boolean prop explosion (`isLarge`, `isSmall`, `isPrimary`).
- Prop drilling for slot content (`leftIconProps`, `rightIconProps`, …).
- Required context hidden behind implicit globals.
- Overriding native props silently (`onClick` replaced instead of composed).
- Changing default behaviour in minor versions.

### Evolving the API
- **Additive changes** (new optional props/values) → minor.
- **Deprecation**: keep the old prop working, log a dev-only warning, document the replacement, provide a codemod, remove in the next major.
- **Experimental** channel (`/unstable`) for new components.
- **Type tests** (`expectTypeOf`) and visual regression tests protect the contract.
- **Usage analytics**: codebase scanning (e.g. react-scanner) shows which props are used before removing.

### Documentation and DX
Storybook stories for every state, controls for props, a11y addon, usage guidelines ("when to use / not use"), copy-paste examples, migration guides. Good defaults and error messages (throw helpful errors in dev if required context is missing).

### Testing
Unit tests with Testing Library for behaviour (keyboard, focus, ARIA), interaction tests in Storybook, visual regression across themes, axe checks, and type tests for the public API.

## Follow-ups
- **Build vs buy (Radix/React Aria/MUI)?** — Buy behaviour/accessibility primitives; build the visual layer and the opinionated API on top.
- **How do you prevent teams from forking components?** — Provide escape hatches (`asChild`, `className`, slots), fast response to requests, and a contribution process.

## Common Mistakes
- Designing for every hypothetical use case up front.
- Inconsistent prop naming across components.
- Breaking changes without codemods.

## Tips
- Mention "composition for structure, props for closed variants, semver for the contract".
