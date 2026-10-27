---
title: "Build an accessible Modal with a portal, focus trap, Esc to close and scroll lock"
level: hard
type: implement
tags: [modal, portal, focus-trap, accessibility, scroll-lock, useEffect]
related: [machine-coding/toast-notifications, machine-coding/tooltip-popover, react/use-debounce]
---

## Question
Build a reusable `Modal` component.

**Must-haves**
- Rendered with a portal into `document.body` so parent `overflow: hidden` / `z-index` cannot clip it.
- Closes on Esc, on clicking the backdrop, and via a close button.
- When open: focus moves into the modal, Tab/Shift+Tab are trapped inside, and the page behind does not scroll.
- When closed: focus returns to the element that opened it.
- Proper dialog semantics for screen readers.

**Stretch goals**
- Nested modals (a confirm dialog on top of a form modal) — Esc closes only the top one.
- Enter/exit animation.
- Explain how you would do this with the native `<dialog>` element instead.

```tsx
const [open, setOpen] = useState(false);
<button onClick={() => setOpen(true)}>Delete account</button>
<Modal open={open} onClose={() => setOpen(false)} title="Delete account?">
  <p>This cannot be undone.</p>
</Modal>
```

## Clues
- `createPortal(children, document.body)` changes where the DOM goes, not where React events bubble — events still bubble through the React tree.
- Save `document.activeElement` when the modal opens and call `.focus()` on it in the effect cleanup.
- For the trap, listen for Tab on the dialog: find all focusable elements inside it; if focus is on the last and Shift is not pressed, move to the first (and the reverse).

## Interview Answer
I would make it a controlled component — the parent owns `open` and passes `onClose` — and render through `createPortal` into `document.body`. All the side effects live in one `useEffect` keyed on `open`: it remembers the previously focused element, moves focus into the dialog, sets `overflow: hidden` on the body, and adds a keydown listener for Esc; the cleanup restores the overflow and focus. The focus trap is a keydown handler on the dialog that queries focusable descendants and wraps Tab from last to first and Shift+Tab from first to last. Semantically the panel is `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing at the title. For the backdrop click, I only close when the mousedown target is the backdrop itself, so a text selection that ends outside does not close it. In production I would seriously consider the native `<dialog>` with `showModal()`, which gives Esc, top-layer rendering and an inert background for free.

## Explanation
### Component tree
```txt
<Parent> (open state)
  └─ Modal ──createPortal──▶ document.body
        └─ div.backdrop (onMouseDown: close if target === backdrop)
             └─ div role="dialog" aria-modal aria-labelledby (onKeyDown: trap Tab)
                  ├─ h2#title
                  ├─ children
                  └─ button "Close"
```

### Complete code

```tsx
// Modal.tsx
import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Module-level stack so nested modals know who is on top
const openStack: symbol[] = [];

export function Modal({ open, onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Keep the latest onClose without re-running the effect when the parent re-renders.
  // (On React 19.2+ you can use useEffectEvent for this instead.)
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose; // don't write refs during render
  });

  useEffect(() => {
    if (!open) return;

    const me = Symbol("modal");
    openStack.push(me);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 1. Move focus inside: first focusable element, else the dialog itself
    const dialog = dialogRef.current!;
    const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog).focus();

    // 2. Scroll lock (compensate for the scrollbar to avoid layout shift)
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    // 3. Esc closes only the top-most modal
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && openStack[openStack.length - 1] === me) {
        e.stopPropagation();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      openStack.splice(openStack.indexOf(me), 1);
      // Only the last modal restores body styles
      if (openStack.length === 0) {
        document.body.style.overflow = overflow;
        document.body.style.paddingRight = paddingRight;
      }
      previouslyFocused?.focus(); // 4. Return focus to the opener
    };
  }, [open]);

  function trapFocus(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const nodes = Array.from(dialogRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) {
      e.preventDefault(); // nothing to move to; keep focus on the dialog
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="backdrop"
      onMouseDown={(e) => {
        // only a press that STARTS on the backdrop closes it
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(0 0 0 / 0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1} // focusable fallback when it has no focusable children
        onKeyDown={trapFocus}
        style={{ background: "white", padding: 24, borderRadius: 8, minWidth: 320, maxWidth: "90vw" }}
      >
        <h2 id={titleId} style={{ marginTop: 0 }}>
          {title}
        </h2>
        {children}
        <button type="button" onClick={onClose} style={{ marginTop: 16 }}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
```

```tsx
// App.tsx
import { useState } from "react";
import { Modal } from "./Modal";

export default function App() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <div style={{ height: "200vh", padding: 24 }}>
      <button onClick={() => setOpen(true)}>Edit profile</button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit profile">
        <label>
          Name <input defaultValue="Jd" />
        </label>
        <button onClick={() => setConfirm(true)}>Discard changes</button>

        <Modal open={confirm} onClose={() => setConfirm(false)} title="Discard changes?">
          <button
            onClick={() => {
              setConfirm(false);
              setOpen(false);
            }}
          >
            Yes, discard
          </button>
        </Modal>
      </Modal>
    </div>
  );
}
```

### Why each piece exists
| Piece | Problem it solves |
|---|---|
| `createPortal` | Ancestor `overflow: hidden`, `transform` or low `z-index` would clip or bury the modal |
| `role="dialog"` + `aria-modal` | Screen readers announce a dialog and (in supporting AT) ignore content behind it |
| `aria-labelledby` | Dialog is announced with its title |
| Initial focus | Keyboard and screen-reader users land inside the dialog |
| Focus trap | Tab would otherwise wander into the page behind |
| Restore focus | Users continue from the button they pressed instead of the top of the page |
| Scroll lock + padding | Background stops scrolling; padding prevents the content jump when the scrollbar disappears |
| `onCloseRef` | The effect does not re-run (and steal focus again) when the parent passes a new inline `onClose` |
| `openStack` | Esc and scroll unlock respect nesting |

### The portal event gotcha
A portal moves DOM nodes, but **React events still bubble through the React component tree**. A click inside the modal will trigger an `onClick` on a parent component that rendered `<Modal>`, even though in the DOM they are siblings. This is why the backdrop check uses `e.target === e.currentTarget` and why you sometimes need `stopPropagation` inside portals.

### The native `<dialog>` alternative
```tsx
const ref = useRef<HTMLDialogElement>(null);
useEffect(() => {
  if (open) ref.current?.showModal();
  else ref.current?.close();
}, [open]);
return (
  <dialog ref={ref} onClose={onClose} aria-labelledby={titleId}>
    …
  </dialog>
);
```
`showModal()` puts the dialog in the browser's top layer (no portal or z-index needed), makes the rest of the page inert (so no hand-written focus trap), closes on Esc (firing `close`/`cancel` events), and returns focus to the opener when closed. You still add scroll lock and backdrop-click handling (`::backdrop` styles it). Knowing both versions — and why the custom one exists — is what makes the answer strong.

### Edge cases
- Content inside the modal changes (fields appear) → the trap re-queries focusables on every Tab, so it stays correct.
- SSR (Next.js): `document` does not exist on the server. Because the component returns `null` until `open` is true and opening needs a client interaction, `createPortal(…, document.body)` only runs in the browser. If a modal can be open on first render, guard with a mounted flag.
- iOS Safari historically ignored `overflow: hidden` on body for touch scrolling; libraries fix this with `position: fixed` on body and restoring `scrollY`.

## Follow-ups
- **How would you animate the exit?** — The modal must stay mounted during the exit animation: keep an internal `isVisible` state, play the CSS animation, and unmount on `animationend`; or use the View Transitions API / a library like Motion.
- **Why `mousedown` and not `click` for the backdrop?** — If a user starts selecting text inside the dialog and releases over the backdrop, `click` fires on the backdrop and closes the modal unexpectedly.
- **How do you hide the rest of the page from screen readers in the custom version?** — Set the `inert` attribute (or `aria-hidden="true"`) on the app root while the modal is open; `inert` also removes it from the tab order, which can replace the manual trap.
- **How would you expose this as `useModal()`?** — Return `{ open, openModal, closeModal, modalProps }`; or build an imperative `confirm()` that returns a Promise resolving with the user's choice.

## Common Mistakes
- Forgetting to restore focus — keyboard users are dumped at the top of the document.
- Putting `onClose` in the effect deps without a ref, so every parent re-render re-runs the effect and yanks focus back to the first field.
- Closing on any click inside the backdrop container, including clicks inside the dialog (missing the `target === currentTarget` check).
- Restoring `overflow` from the first modal while a second is still open.

## Tips
- List the four behaviours before coding: **portal, focus in/trap/restore, Esc, scroll lock** — then tick them off.
- End by mentioning `<dialog>.showModal()`. Interviewers frequently ask "is there a native way?".
