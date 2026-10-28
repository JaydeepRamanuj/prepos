---
title: "Build an accessible modal with <dialog>, focus handling and inert"
level: hard
type: implement
tags: [dialog, modal, focus-trap, inert, aria-modal, showModal]
related: [react/portals, html-css/keyboard-focus-basics, machine-coding/modal-dialog]
---

## Question
Implement an accessible modal dialog. Requirements: opens from a button, traps focus, closes on Escape and backdrop click, returns focus to the trigger, prevents background scrolling and interaction, has an accessible name, and works in React. Explain why native `<dialog>` is preferred over a custom div.

## Clues
- `HTMLDialogElement.showModal()` provides several of these behaviours natively.
- The backdrop is available as `::backdrop`.
- If you build it manually you need `role="dialog"`, `aria-modal`, focus management and `inert` on the rest of the page.

## Interview Answer
I'd use the native `<dialog>` element and call `showModal()`. It renders in the top layer (no z-index fights), makes the rest of the document inert, traps focus inside, closes on Escape (firing `cancel` then `close`), moves focus into the dialog and restores it to the previously focused element on close, and exposes a `::backdrop` pseudo-element. I give it an accessible name with `aria-labelledby` pointing to its heading, close it from buttons with `<form method="dialog">` or `dialog.close()`, and handle backdrop clicks by comparing the click target with the dialog element. In React I keep a ref and call `showModal`/`close` in an effect, controlled by an `open` prop. I lock body scroll with `overflow: hidden` (or `overscroll-behavior`), and for custom implementations I'd need `role="dialog"`, `aria-modal="true"`, a focus trap, Escape handling, restoring focus and `inert` on siblings.

## Explanation
### Native HTML version

```html
<button id="open" type="button">Delete account</button>

<dialog id="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
  <h2 id="confirm-title">Delete account?</h2>
  <p id="confirm-desc">This cannot be undone.</p>
  <form method="dialog">
    <button value="cancel" autofocus>Cancel</button>
    <button value="confirm">Delete</button>
  </form>
</dialog>

<script>
  const dialog = document.getElementById("confirm");
  document.getElementById("open").addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "confirm") deleteAccount();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close("cancel");      // click on the backdrop area
  });
</script>
```

```css
dialog::backdrop { background: rgb(0 0 0 / 0.5); }
dialog { border: 0; border-radius: 12px; padding: 1.5rem; max-width: min(32rem, 90vw); }
body:has(dialog[open]) { overflow: hidden; }           /* lock scroll */
```

Note: the "click on the backdrop" check works when the dialog has no padding box wrapper; wrap content in an inner element and compare against the dialog to avoid closing on padding clicks.

### React wrapper

```tsx
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}                                   // fires for Escape, form method=dialog, close()
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
```

Render children only when open if they have side effects or heavy content: `{open && children}`.

### What the browser gives you
- Top layer: always above other content regardless of z-index or overflow.
- Rest of the page inert while a modal dialog is open (not clickable, not focusable, hidden from assistive tech).
- Focus moves to the first focusable element (or `autofocus`), and returns to the opener on close in modern browsers.
- Escape triggers `cancel` then closes; call `preventDefault()` on `cancel` if closing needs confirmation.
- `::backdrop` styling; `open` attribute reflects state.

### Manual (div-based) requirements

| Requirement | How |
|---|---|
| Role and name | `role="dialog"` (or `alertdialog`), `aria-modal="true"`, `aria-labelledby` |
| Focus on open | move focus to the first control or the dialog (`tabindex="-1"`) |
| Trap focus | cycle Tab/Shift+Tab within; or `inert` on the rest of the page |
| Escape | keydown handler closes |
| Restore focus | save `document.activeElement` before opening, focus it on close |
| Background | `inert` on siblings or app root; lock scroll |
| Portal | render at the end of `body` to avoid clipping/stacking |

```tsx
// Making the app root inert while a custom modal is open
document.getElementById("app-root")!.inert = true;
```

### Design guidance
- Destructive confirmations: default focus on the safe action ("Cancel").
- Keep modals for tasks that require attention; consider non-modal popovers (`popover` attribute) for menus and tooltips.
- Avoid nested modals.
- Make content scrollable inside the dialog (`max-height` + `overflow: auto`) on small screens.
- Respect `prefers-reduced-motion` for open animations; use `@starting-style` and `transition-behavior: allow-discrete` for animating `display` changes (modern browsers).

### Testing
Keyboard: open, Tab around, Escape, confirm focus returns; screen reader: the dialog name is announced; mobile: scroll behaviour; automated: Testing Library `getByRole("dialog", { name })`.

## Follow-ups
- **`dialog.show()` vs `showModal()`?** — `show()` opens non-modal (no inert, no backdrop, no top layer).
- **Why is `aria-modal` not enough?** — It's a hint for assistive tech; it doesn't block interaction or trap focus in the browser.

## Common Mistakes
- Using a div with `position: fixed` and no focus management.
- Forgetting to restore focus.
- Closing on any click inside the dialog because of event bubbling.

## Tips
- Lead with "native dialog gives top layer, inert, focus and Escape for free".
