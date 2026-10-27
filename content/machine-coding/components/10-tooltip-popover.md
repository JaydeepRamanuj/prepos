---
title: "Build a tooltip/popover with smart positioning, hover delay and accessibility"
level: hard
type: implement
tags: [tooltip, popover, positioning, portal, a11y, focus, floating-ui]
related: [machine-coding/modal-dialog, machine-coding/dropdown-select]
---

## Question
Build a `Tooltip` component that wraps a trigger element and shows a small floating label.

**Must-haves**
- Shows on hover and keyboard focus; hides on mouse leave, blur and Escape.
- Placed above the trigger by default, centred horizontally.
- Flips to below if there is no room above; stays inside the viewport horizontally.
- Rendered in a portal so `overflow: hidden` parents do not clip it.
- Accessible: the trigger is described by the tooltip (`aria-describedby`, `role="tooltip"`).

**Stretch goals**
- Open delay (e.g. 300ms) and a short close delay so moving the pointer onto the tooltip does not flicker.
- Update position on scroll/resize.
- A click-triggered popover variant.

```tsx
<Tooltip content="Copy link"><button>Copy</button></Tooltip>
```

## Clues
- Measure the trigger with `getBoundingClientRect()` and the tooltip with its own rect, then compute `top`/`left` in `useLayoutEffect` so it positions before paint.
- Use `position: fixed` with viewport coordinates so you do not need to account for scroll offsets.
- Generate an id with `useId()` for the `aria-describedby` link.

## Interview Answer
I keep an `open` state and a ref to the trigger. Hover and focus handlers open it (after a short timer so accidental passes do not flash), and mouse leave, blur and Escape close it. The tooltip renders through `createPortal` into `document.body` with `position: fixed`, so no ancestor's `overflow` or stacking context clips it. Positioning runs in `useLayoutEffect` once the tooltip is mounted: I read the trigger's rect and the tooltip's size, prefer placing it above and centred, flip below when `top` would be negative, and clamp `left` to the viewport with a small margin. For accessibility the tooltip has `role="tooltip"` and an id referenced by the trigger's `aria-describedby`, and it must be reachable by keyboard focus, not just hover. In production I would reach for Floating UI or Radix, which add collision handling, arrow placement and scroll tracking, but the core is measure, place, clamp.

## Explanation
### Behaviour model
- **Open triggers:** `pointerenter`, `focus`. **Close triggers:** `pointerleave`, `blur`, `Escape`.
- **Timers:** an open delay avoids flashing when the mouse sweeps across; clear timers on unmount.
- **Touch:** hover does not exist, so tooltips are not a good fit for essential information; use a popover with a click toggle.

### Code

```tsx
import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

type Props = { content: string; children: ReactElement<React.HTMLAttributes<HTMLElement>>; delay?: number };

const GAP = 8;
const MARGIN = 8;

export function Tooltip({ content, children, delay = 300 }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();

  const show = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(true), delay); };
  const hide = () => { window.clearTimeout(timer.current); setOpen(false); setPos(null); };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Measure after render, before paint, so there is no visible jump
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();

    let top = t.top - tip.height - GAP;                    // prefer above
    if (top < MARGIN) top = t.bottom + GAP;                // flip below
    let left = t.left + t.width / 2 - tip.width / 2;       // centred
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - tip.width - MARGIN));
    setPos({ top, left });
  }, [open, content]);

  const trigger = cloneElement(children, {
    ref: (el: HTMLElement | null) => { triggerRef.current = el; },
    onPointerEnter: (e) => { children.props.onPointerEnter?.(e as never); show(); },
    onPointerLeave: (e) => { children.props.onPointerLeave?.(e as never); hide(); },
    onFocus: (e) => { children.props.onFocus?.(e as never); show(); },
    onBlur: (e) => { children.props.onBlur?.(e as never); hide(); },
    "aria-describedby": open ? id : undefined,
  } as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
            className="pointer-events-none z-50 rounded bg-ink px-2 py-1 text-xs text-paper"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
```

The first render is `visibility: hidden` at `0,0` purely to be measured; the layout effect then sets the real position before the browser paints. Passing `ref` via `cloneElement` works as a prop in React 19; on older versions you would need `forwardRef` or a wrapper element.

### Why a portal and `fixed`
A tooltip inside a card with `overflow: hidden` or a transformed parent would be clipped or mis-positioned. A portal escapes the DOM ancestry, and `position: fixed` with `getBoundingClientRect()` (viewport coordinates) removes any scroll-offset arithmetic.

### Edge cases
- Trigger scrolls or the window resizes while open: re-run placement from `scroll` (capture) and `resize` listeners, or close on scroll.
- Disabled buttons do not fire pointer events in some browsers: wrap them in a `span`.
- Interactive content (links) inside means it is a popover, not a tooltip: keep it open while the pointer is over it and manage focus.
- Screen readers: tooltip text should be supplementary; do not hide essential labels in it.

## Follow-ups
- **How would you add arrow placement?** — Compute the trigger centre relative to the clamped `left` and position a rotated square at that offset.
- **Why not CSS-only?** — CSS tooltips cannot escape clipping or flip on collision without anchor positioning; the CSS Anchor Positioning API is closing that gap in modern browsers.

## Common Mistakes
- Rendering inside the trigger so overflow clips it.
- Hover-only: keyboard users never see it.
- Measuring in `useEffect`, causing a flash at the wrong position.

## Tips
- Say "measure, place, flip, clamp" and mention Floating UI as the production choice.
