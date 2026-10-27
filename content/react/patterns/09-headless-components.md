---
title: "What is a headless component, and how would you design one?"
level: advanced
type: design
tags: [headless, design-systems, hooks, accessibility, api-design]
related: [react/compound-components, react/render-props-hocs, react/custom-hook-design-rules, architecture/design-system-component-api]
---

## Question
What does "headless" mean for UI components (Radix, Headless UI, React Aria, TanStack Table)? Design a headless `useDisclosure` / `Disclosure` or `Combobox` API. What trade-offs vs styled libraries?

## Clues
- Separate behaviour and accessibility from visuals.
- The logic can be exposed as hooks, compound components or prop getters.
- Consumers must be able to render their own markup and classes.

## Interview Answer
A headless component provides behaviour, state and accessibility, such as keyboard navigation, focus management and ARIA wiring, without imposing markup or styling. The library supplies the hard parts; the app supplies the design system. I can expose it in three styles: a hook returning state and prop-getter functions (`getTriggerProps`), compound components that render unstyled elements and accept `className` and `asChild`, or render props. A good headless API keeps controlled/uncontrolled modes, is accessible by default, composes with any styling solution, and forwards refs and arbitrary props. The trade-off is more assembly work and less out-of-the-box polish than a fully styled library, but much more flexibility and a smaller bundle for custom design systems.

## Explanation
### What "headless" separates

```txt
Styled library:  behaviour + a11y + markup + styles   (MUI, Ant Design)
Headless:        behaviour + a11y                      (Radix, React Aria, Headless UI)
Your design system: tokens + styles on top (shadcn/ui is Radix + Tailwind)
```

### Hook with prop getters

```tsx
function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const id = useId();

  return {
    open,
    toggle: () => setOpen((o) => !o),
    getTriggerProps: () => ({
      "aria-expanded": open,
      "aria-controls": id,
      onClick: () => setOpen((o) => !o),
    }),
    getPanelProps: () => ({ id, hidden: !open }),
  };
}

function FAQ() {
  const d = useDisclosure();
  return (
    <>
      <button className="btn" {...d.getTriggerProps()}>What is PrepOS?</button>
      <div className="panel" {...d.getPanelProps()}>A study notebook.</div>
    </>
  );
}
```

Consumers choose elements and classes; the hook guarantees correct ARIA attributes.

### Compound components + `asChild`

```tsx
<Disclosure>
  <Disclosure.Trigger asChild><MyButton>Details</MyButton></Disclosure.Trigger>
  <Disclosure.Content className="panel">…</Disclosure.Content>
</Disclosure>
```

`asChild` (Radix's `Slot`) merges the library's props and handlers into the child element, avoiding extra wrapper DOM and allowing custom components (for example Next.js `Link`).

### API design principles
1. **Accessible by default:** roles, states, keyboard interactions per WAI-ARIA Authoring Practices.
2. **Controlled and uncontrolled** (`open`/`defaultOpen`/`onOpenChange`).
3. **Compose handlers:** user's `onClick` runs, then the library's, unless `preventDefault`.
4. **Forward refs and rest props** so styling, test ids and data attributes work.
5. **Expose state via data attributes** (`data-state="open"`) so CSS and Tailwind can style states without JS.
6. **Don't hard-code DOM:** allow element substitution (`as` / `asChild`).
7. **Stable identities:** memoised handlers and ids (`useId`).
8. **SSR-safe and tree-shakeable:** one export per part.

### Trade-offs

| Headless | Styled library |
|---|---|
| Full design control | Fast to start |
| Smaller CSS footprint | Opinionated theme |
| More assembly work | Less flexible overrides |
| Great for design systems | Great for internal tools |

### When to build vs adopt
Building accessible comboboxes, menus and dialogs is hard (focus, typeahead, screen readers). Prefer Radix/React Aria and build wrappers; write your own headless hook only for simple cases or very specific needs.

## Follow-ups
- **What does shadcn/ui do?** — Copies Radix-based components into your repo styled with Tailwind, so you own the code.
- **How do you test headless behaviour?** — Interaction tests with Testing Library and `user-event`, plus accessibility checks.

## Common Mistakes
- Shipping "headless" components that lack keyboard support.
- Merging props naively and overriding the user's handlers.

## Tips
- Mention prop getters, `asChild`, and data-state attributes by name.
