---
title: "What are React portals, and how do events and context behave through them?"
level: medium
type: concept
tags: [portals, createPortal, modal, events, z-index, accessibility]
related: [react/use-on-click-outside, machine-coding/modal-dialog, html-css/stacking-contexts]
---

## Question
What does `createPortal` do and why would you use it for modals and tooltips? How do event bubbling and context work across a portal, and what accessibility work remains?

## Interview Answer
`createPortal(children, domNode)` renders children into a different DOM node, typically `document.body`, while keeping them in the same place in the React tree. I use it for modals, tooltips, dropdowns and toasts so they escape ancestors that have `overflow: hidden`, `transform` or a stacking context that would clip or hide them. Because the React tree is unchanged, context works as usual, and synthetic events bubble from the portal to its React ancestors even though the DOM nodes are elsewhere. Native DOM listeners follow the DOM tree instead. A portal is only a rendering location: I still must handle focus trapping, `Escape` to close, `aria-modal`, restoring focus and scroll locking, or use the native `<dialog>` element or a library.

## Explanation
### Basic usage

```tsx
import { createPortal } from "react-dom";

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
```

With SSR or Next.js, `document` doesn't exist on the server. Render the portal only after mount (`useEffect` setting `mounted`) or inside a Client Component that runs after hydration.

### Why portals
A positioned child can't escape an ancestor with `overflow: hidden`, and `position: fixed` breaks inside an ancestor with `transform`, `filter` or `will-change: transform`, because that ancestor becomes the containing block. `z-index` is also limited by stacking contexts. Rendering at the body level avoids these.

### Events and context

```tsx
<div onClick={() => console.log("parent clicked")}>
  <Modal open>…click here…</Modal>     {/* DOM is under body, React parent is the div */}
</div>
```

Clicking inside the modal logs "parent clicked" because React synthetic events bubble through the React tree. Stop propagation if unwanted. A native `document.addEventListener("click", …)` sees the DOM hierarchy instead, which is why click-outside hooks must be portal-aware.

Context values from ancestors (theme, i18n) are available to portalled children.

### Accessibility checklist for dialogs
1. `role="dialog"` (or `alertdialog`), `aria-modal="true"`, label via `aria-labelledby`.
2. Move focus into the dialog when it opens; trap Tab inside; return focus to the trigger on close.
3. Close on `Escape` and on backdrop click.
4. Prevent background scrolling and mark the rest of the page inert (the `inert` attribute is now widely supported).
5. Announce changes where relevant.

Native `<dialog>` with `showModal()` gives focus trapping, top-layer rendering (no z-index issues), `Escape` handling and `::backdrop` for free. Popover API and top layer also reduce the need for portals.

### Portal targets
Use a dedicated container (`<div id="modal-root">`) for easier styling and testing, or `document.body`.

## Follow-ups
- **Where do error boundaries catch portal errors?** — At the React ancestors, as for normal children.
- **Does the portal content unmount with the parent?** — Yes, lifecycle follows the React tree.

## Common Mistakes
- Using `document.body` during SSR.
- Forgetting focus management.
- Assuming DOM-based click-outside works across portals.

## Tips
- Mention the native `<dialog>` as the modern baseline.
