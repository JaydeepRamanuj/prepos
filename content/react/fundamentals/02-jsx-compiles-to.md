---
title: "What does JSX compile to?"
level: easy
type: concept
tags: [jsx, fundamentals, babel, elements]
related: [react/declarative-ui, react/reconciliation-diffing, react/index-as-key]
---

## Question
Browsers can't run JSX. What does `<Button variant="primary">Save</Button>` turn into after compilation, and what is the resulting value at runtime?

## Interview Answer
JSX is syntax sugar for function calls. With the modern JSX transform (React 17+), the compiler rewrites each tag into a call to `jsx()` or `jsxs()` imported automatically from `react/jsx-runtime`; with the classic transform it became `React.createElement(type, props, ...children)`. The call returns a plain, immutable object — a React element — with a `type`, `props` (including `children`) and `key`. Lowercase tags become strings like `"div"`, capitalised tags become references to the component function, which is why components must start with a capital letter. An element is only a description; nothing is rendered until React walks the tree.

## Explanation
### Before and after
```tsx
// You write
<Button variant="primary">Save</Button>

// Modern transform (automatic runtime) — import is inserted for you
import { jsx as _jsx } from "react/jsx-runtime";
_jsx(Button, { variant: "primary", children: "Save" });

// Classic transform (why old files had `import React from "react"`)
React.createElement(Button, { variant: "primary" }, "Save");
```

The resulting element is roughly:

```js
{
  $$typeof: Symbol.for("react.transitional.element"), // marks it as a real element
  type: Button,                 // function reference, or "div" for host tags
  key: null,
  props: { variant: "primary", children: "Save" },
}
```

The `$$typeof` symbol is a security detail: JSON from a server cannot contain a Symbol, so injected objects can't masquerade as elements.

### Consequences you can explain from this
- **Capitalisation matters.** `<button>` → `"button"` string; `<Button>` → the `Button` variable. A lowercase component name is treated as an unknown HTML tag.
- **Expressions only.** `{}` holds an expression because it becomes a function argument — so no `if` statements inside JSX; use ternaries, `&&`, or compute before `return`.
- **One root.** A component returns one value; `<>...</>` (Fragment) groups siblings without a DOM node.
- **`key` is not a prop.** It is pulled out onto the element so React can identify list items; the child can't read `props.key`.
- **`className`, `htmlFor`, camelCase events** — because these are JS object keys mapped to DOM properties.
- **React 19:** `ref` is now an ordinary prop for function components (no `forwardRef` needed for new code).

### Rendering `{0 && <List />}`
Since JSX children are values, `0 && <List/>` evaluates to `0`, and React renders numbers — so you see a stray "0". Use `count > 0 && ...` or a ternary.

## Follow-ups
- **Why did React 17 remove the need to import React?** — The new transform imports `jsx` from `react/jsx-runtime` automatically, and it is slightly more efficient than `createElement`.
- **Can you use React without JSX?** — Yes, call `createElement` directly; JSX is optional sugar.

## Common Mistakes
- Thinking JSX produces DOM nodes or HTML strings. It produces plain objects.
- Saying JSX is "HTML in JS" — attributes, escaping and expressions follow JavaScript rules.
- Using `&&` with a number on the left and getting `0` on screen.

## Tips
- Write the `_jsx(Button, { variant, children })` line on the whiteboard — showing you know the transform output is an instant credibility boost.
