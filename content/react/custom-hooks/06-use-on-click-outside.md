---
title: "Write useOnClickOutside (and handle touch, portals and Escape)"
level: medium
type: implement
tags: [custom-hooks, refs, events, dropdown, popover]
related: [react/use-event-listener, react/portals, machine-coding/dropdown-select]
---

## Question
Write `useOnClickOutside(ref, handler)` that calls `handler` when the user presses outside the referenced element. Use it for a dropdown, and mention what breaks with portals and with `click` vs `pointerdown`.

```tsx
const ref = useRef<HTMLDivElement>(null);
useOnClickOutside(ref, () => setOpen(false));
```

## Interview Answer
I attach a `pointerdown` listener on `document`, check whether the event target is contained in the ref's element using `element.contains(event.target)`, and call the handler if it is not. I use `pointerdown` instead of `click` so it fires before focus or click handlers elsewhere and works for mouse, touch and pen with one listener. The handler is kept in a ref so inline arrow functions don't cause re-subscription, and the listener is removed in the effect cleanup. Edge cases: portalled children (a menu rendered into `document.body`) are outside the DOM element but inside the React tree, so I either pass multiple refs or use `event.composedPath()`; and the same click that opened the popover must not immediately close it.

## Explanation
### Implementation

```tsx
import { useEffect, useRef, type RefObject } from "react";

export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null> | RefObject<T | null>[],
  handler: (event: PointerEvent) => void
) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    const refs = Array.isArray(ref) ? ref : [ref];

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !target.isConnected) return;          // target removed during the event
      const inside = refs.some((r) => r.current?.contains(target));
      if (!inside) handlerRef.current(event);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref]);
}
```

### Dropdown usage

```tsx
function Dropdown() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={menuRef}>
      <button aria-expanded={open} onClick={() => setOpen((o) => !o)}>Menu</button>
      {open && <ul role="menu">…</ul>}
    </div>
  );
}
```

The trigger button sits inside `menuRef`, so clicking it isn't "outside" and doesn't double-toggle.

### Pitfalls
- **`click` vs `pointerdown`/`mousedown`:** with `click`, a handler that unmounts the clicked element makes `contains` return false, closing the menu incorrectly. `pointerdown` runs earlier.
- **Portals:** a menu rendered via `createPortal` into `body` isn't inside `menuRef.current` in the DOM, so clicks on it count as outside. Pass both refs, or check `event.composedPath()`; React synthetic events bubble through portals, DOM events don't.
- **Opening click closes it:** if the listener is attached synchronously while the opening click is still bubbling, it can catch it. Attaching in an effect after open (and using `pointerdown`) avoids this.
- **Shadow DOM/iframes:** `contains` doesn't cross shadow roots; use `composedPath()`.
- **Accessibility:** also close on `Escape`, and on focus leaving (`focusout` with `relatedTarget` check).
- **Passive/capture:** listening in the capture phase (`true`) ensures handlers that call `stopPropagation` don't hide the event.

### Alternatives
The native `<dialog>` and the Popover API (`popover` attribute) provide light dismiss ("click outside to close") without custom code in modern browsers; Radix UI primitives handle these cases for you.

## Follow-ups
- **Why check `isConnected`?** — The clicked node may have been removed by a React update before your handler runs, making `contains` false.
- **How would you only listen while open?** — Accept an `enabled` flag and skip subscribing when false.

## Common Mistakes
- Using `click` and then fighting unmount timing bugs.
- Forgetting portals.
- Not cleaning up the document listener.

## Tips
- Mention the Popover API / Radix as production alternatives.
