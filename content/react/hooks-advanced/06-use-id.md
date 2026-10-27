---
title: "What is useId for, and why not use Math.random or a counter?"
level: easy
type: concept
tags: [useId, hydration, accessibility, ssr]
related: [react/render-and-commit, react/strict-mode-double-invoke, nextjs/hydration-mismatch-scenario]
---

## Question
What does `useId` do? Why can't you generate ids with `Math.random()` or a module-level counter, and what should you not use it for?

## Interview Answer
`useId` generates a unique, stable string per component instance, used mainly to link form labels and ARIA attributes such as `htmlFor`, `aria-describedby` and `aria-labelledby`. The id is the same on the server and on the client, so hydration doesn't mismatch. `Math.random()` or a counter produces different values on server and client, or differs between renders and StrictMode double renders, causing hydration errors and unstable DOM. `useId` is not for list keys, and it shouldn't be used as a database or CSS selector id; the generated string contains characters such as colons, guillemets or underscores depending on the React version, so use `querySelector` carefully. Call it once per component and derive related ids from the result.

## Explanation
### Usage

```tsx
function Field({ label }: { label: string }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={hintId} />
      <p id={hintId}>We never share this.</p>
    </div>
  );
}
```

Each `Field` instance gets its own id, so rendering it twice does not collide.

### Why random or counters fail

```tsx
let n = 0;
function Bad() {
  const id = `field-${n++}`;        // differs between server render and client hydration
  return <input id={id} />;
}
```

- SSR renders `field-0`, the client hydrates and may produce `field-3` (it has rendered other things), causing a hydration mismatch.
- Re-renders would change the id unless stored.
- Concurrent rendering and StrictMode call render more than once.

`useId` derives the id from the component's position in the tree, which is identical on both sides.

### What not to do
- Do not use it for `key` in lists; keys should come from your data.
- Don't rely on its format (it has changed between React versions); treat as opaque.
- Don't use it as an id in CSS selectors without escaping.
- Don't call it conditionally.

### Multiple related ids
Generate one id and add suffixes, rather than calling `useId` repeatedly.

### Related
For global unique ids across separate React roots, pass `identifierPrefix` to `createRoot`/`hydrateRoot`.

## Follow-ups
- **Does it work in Server Components?** — Yes, it can be used in Server and Client Components; ids stay consistent with client hydration.
- **Is the id valid for CSS?** — Not necessarily; escape it with `CSS.escape` when used in selectors.

## Common Mistakes
- Using `Math.random()` and ending up with hydration warnings.
- Using it as a list key.

## Tips
- Tie it to hydration and accessibility to show you know the motivation.
