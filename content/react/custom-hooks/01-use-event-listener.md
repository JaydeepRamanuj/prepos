---
title: "Write a useEventListener hook"
level: medium
type: implement
tags: [custom-hooks, useEffect, event-listeners, useRef, cleanup]
related: [react/use-effect-cleanup, react/use-effect-event, react/stale-closures-in-effects, react/use-previous]
---

## Question
Write `useEventListener(target, type, handler, options?)` that attaches a listener to `window`, `document` or an element ref. It must clean up on unmount, not re-subscribe when an inline handler changes, and always call the latest handler.

```tsx
useEventListener(window, "keydown", (e) => {
  if (e.key === "Escape") close();
});
```

## Interview Answer
The hook stores the latest handler in a ref so callers can pass inline functions without causing re-subscription, and subscribes in an effect that depends only on the target, event type and options. The effect adds a stable wrapper that calls `handlerRef.current(event)`, and its cleanup removes the same wrapper, so nothing leaks. The ref is updated after each render so it never calls a stale closure. In React 19.2+ the same can be written with `useEffectEvent` instead of the manual ref. For element targets I accept a ref and read `.current` inside the effect.

## Explanation
### Implementation

```tsx
import { useEffect, useRef } from "react";

type Target = Window | Document | HTMLElement | null | undefined;

export function useEventListener<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions
): void;
export function useEventListener(
  target: Target | React.RefObject<HTMLElement | null>,
  type: string,
  handler: (event: Event) => void,
  options?: AddEventListenerOptions
): void;
export function useEventListener(
  target: any,
  type: string,
  handler: (event: any) => void,
  options?: AddEventListenerOptions
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;            // always the latest, no resubscribe
  });

  const { capture, passive, once } = options ?? {};

  useEffect(() => {
    const el = target && "current" in target ? target.current : target;
    if (!el) return;

    const listener = (e: Event) => handlerRef.current(e);
    const opts = { capture, passive, once };
    el.addEventListener(type, listener, opts);
    return () => el.removeEventListener(type, listener, opts);
  }, [target, type, capture, passive, once]);
}
```

### Usage

```tsx
function Modal({ onClose }: { onClose: () => void }) {
  useEventListener(window, "keydown", (e) => e.key === "Escape" && onClose());
  return <div role="dialog">…</div>;
}

function Box() {
  const ref = useRef<HTMLDivElement>(null);
  useEventListener(ref, "pointerdown", (e) => console.log(e.clientX));
  return <div ref={ref} />;
}
```

### Design notes
- Passing `options` as an inline object would change identity each render, so destructure primitives into the dependency array.
- `removeEventListener` must receive the same `capture` flag as `addEventListener`, or removal silently fails.
- The ref-in-effect pattern is the classic "latest ref"; it avoids stale closures and avoids re-attaching listeners (which could drop events or reorder them).
- SSR safety: `window` is not defined on the server. Referencing it as an argument (`useEventListener(window, ...)`) would throw during server render; accept `typeof window !== "undefined" ? window : null`, or pass a getter / use a ref.
- Use `passive: true` for scroll/touch listeners to avoid blocking scrolling.

### With `useEffectEvent`

```tsx
const onEvent = useEffectEvent(handler);
useEffect(() => {
  target.addEventListener(type, onEvent);
  return () => target.removeEventListener(type, onEvent);
}, [target, type]);
```

## Follow-ups
- **Why not put `handler` in the dependency array?** — Inline functions change every render, causing constant remove/add cycles.
- **Why update the ref in an effect and not during render?** — Writing refs during render is impure and may be discarded in concurrent rendering.

## Common Mistakes
- Forgetting cleanup, or passing a different function to `removeEventListener`.
- Using a `window` reference during SSR.
- Ignoring options when removing.

## Tips
- The "latest ref" pattern is the main point; say the name.
