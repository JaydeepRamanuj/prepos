---
title: "Build a toast notification system with a queue, auto-dismiss and a useToast hook"
level: advanced
type: implement
tags: [toast, context-api, useReducer, timers, portal, aria-live]
related: [machine-coding/modal-dialog, machine-coding/countdown-stopwatch]
---

## Question
Build a toast system that any component in the app can trigger.

**Must-haves**
- A `ToastProvider` at the root and a `useToast()` hook: `toast.show({ message, type, duration })` from anywhere.
- Types: `success | error | info`. Each toast auto-dismisses after `duration` (default 3s) and has a close button.
- Show at most 3 toasts at a time; extra toasts wait in a queue and appear as others leave.
- Screen readers announce new toasts.

**Stretch goals**
- Pause the auto-dismiss timer while the toast is hovered or focused.
- Position option (top-right, bottom-center…).
- `toast.promise(promise, { loading, success, error })`.

```tsx
const toast = useToast();
<button onClick={() => toast.show({ message: "Saved!", type: "success" })}>Save</button>
```

## Clues
- Separate the API (a stable `show`/`dismiss` pair exposed through context) from the rendering (a container that maps over state). Components calling `useToast` should not re-render when a toast appears.
- The queue does not need its own data structure: keep one array of all toasts and render only `toasts.slice(0, MAX_VISIBLE)`.
- Put each toast's timer inside the `Toast` component's own effect, so it starts only when the toast becomes visible and is cleaned up when it unmounts.

## Interview Answer
I would split it into three parts: a provider that owns a `toasts` array in a reducer, a context that exposes only stable `show` and `dismiss` functions, and a container that renders through a portal. The queue falls out naturally — the array is in arrival order and the container renders only the first three, so when one is dismissed the next one slides in. Each visible `Toast` owns its timer in a `useEffect`, so a queued toast's countdown does not start until it is actually on screen, and unmounting clears it. For pause-on-hover I track remaining time: on mouse enter I clear the timeout and subtract elapsed time; on leave I restart with what is left. For accessibility the container is an `aria-live="polite"` region, errors use `role="alert"`, and the close button has an accessible label.

## Explanation
### Architecture
```txt
<ToastProvider>                state: toasts[] (reducer)
  ├─ ToastApiContext.Provider  value: { show, dismiss }  ← stable, memoised
  │     └─ <App/> … any component calls useToast()
  └─ createPortal(<ToastContainer/>, body)
        └─ toasts.slice(0, 3).map → <Toast/> (owns its own timer)
```

Why expose only the functions through context? If the context value contained `toasts`, every component that calls `useToast()` would re-render each time a toast is added or removed. The API never changes, so consumers never re-render. That is the "split state and dispatch contexts" pattern.

### Complete code

```tsx
// toast.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType; duration: number };
type ShowOptions = { message: string; type?: ToastType; duration?: number };

type Action = { type: "add"; toast: Toast } | { type: "remove"; id: number };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case "add":
      return [...state, action.toast]; // queue order = array order
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

type ToastApi = { show: (opts: ShowOptions) => number; dismiss: (id: number) => void };
const ToastApiContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const dismiss = useCallback((id: number) => dispatch({ type: "remove", id }), []);
  const show = useCallback(({ message, type = "info", duration = 3000 }: ShowOptions) => {
    const id = nextId++;
    dispatch({ type: "add", toast: { id, message, type, duration } });
    return id; // lets callers dismiss programmatically
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastApiContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          style={{ position: "fixed", top: 16, right: 16, display: "grid", gap: 8, zIndex: 2000 }}
        >
          {toasts.slice(0, MAX_VISIBLE).map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastApiContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastApiContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const COLORS: Record<ToastType, string> = { success: "#16a34a", error: "#dc2626", info: "#2563eb" };

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const start = useCallback(() => {
    clearTimeout(timer.current); // never run two timers (e.g. hover + focus)
    if (!Number.isFinite(remaining.current)) return; // sticky toast
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onDismiss(toast.id), remaining.current);
  }, [onDismiss, toast.id]);

  const pause = useCallback(() => {
    if (timer.current === undefined) return; // already paused (hover + focus together)
    clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current -= Date.now() - startedAt.current; // bank the time already shown
  }, []);

  // Timer starts when the toast becomes VISIBLE (mounts), not when it is queued
  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
      style={{
        minWidth: 260,
        padding: "12px 16px",
        borderRadius: 6,
        color: "white",
        background: COLORS[toast.type],
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        style={{ background: "none", border: 0, color: "inherit", cursor: "pointer" }}
      >
        ✕
      </button>
    </div>
  );
}
```

```tsx
// App.tsx
import { ToastProvider, useToast } from "./toast";

function SaveButton() {
  const toast = useToast();
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => toast.show({ message: "Profile saved", type: "success" })}>Save</button>
      <button onClick={() => toast.show({ message: "Payment failed", type: "error", duration: 6000 })}>
        Fail
      </button>
      <button
        onClick={() => {
          for (let i = 1; i <= 6; i++) toast.show({ message: `Bulk message ${i}` });
        }}
      >
        Spam 6
      </button>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <SaveButton />
    </ToastProvider>
  );
}
```

### How the queue works
```txt
toasts = [A, B, C, D, E]     visible = [A, B, C]   queued = [D, E]
A times out → remove A
toasts = [B, C, D, E]        visible = [B, C, D]   D mounts → D's timer starts now
```
No separate queue array, no "promote from queue" logic. The `key={t.id}` keeps B and C mounted (their timers keep running) while D mounts fresh.

### Pause on hover — the remaining-time trick
`setTimeout` cannot be paused, so you simulate it: record `startedAt` when starting, and on pause subtract the elapsed time from `remaining`. On resume, start a new timeout for `remaining` ms. The refs hold this because changing them must not re-render.

### Accessibility
- The container is a live region present from the start (live regions that are inserted together with their content are often not announced).
- `role="status"` (polite) for info/success, `role="alert"` (assertive) for errors.
- Pause on focus as well as hover, so keyboard users can reach the close button before it vanishes. WCAG 2.2.1 (Timing Adjustable) is the rule behind this.
- Do not put essential actions only in a toast — it may disappear before a screen-reader user gets there.

### Edge cases
- `useToast` outside the provider → throw a clear error (fail fast).
- Same message spammed → optionally dedupe in the reducer by message.
- `duration: Infinity` for sticky toasts → `setTimeout` with `Infinity` fires immediately (the delay is converted to 0), which is why `start()` returns early when the duration is not finite.
- Next.js: `ToastProvider` uses state and portals, so it must be a Client Component (`"use client"`) wrapped around `children` in the root layout; Server Components below it are still fine.

### Stretch: `toast.promise`
```ts
async function promise<T>(p: Promise<T>, msgs: { loading: string; success: string; error: string }) {
  const id = show({ message: msgs.loading, duration: Infinity });
  try {
    const result = await p;
    dismiss(id);
    show({ message: msgs.success, type: "success" });
    return result;
  } catch (e) {
    dismiss(id);
    show({ message: msgs.error, type: "error" });
    throw e;
  }
}
```
A nicer version adds an `update` action to the reducer to change the existing toast in place instead of replacing it.

## Follow-ups
- **How would you call `toast()` outside React (e.g. in an Axios interceptor)?** — Use a tiny external store (a module with `subscribe`/`getSnapshot`) and read it in the container with `useSyncExternalStore`. That is how libraries like Sonner and react-hot-toast expose a plain `toast()` function.
- **Why `useReducer` instead of `useState`?** — Multiple transitions (add, remove, update) are easier to read and test as a pure function, and `dispatch` is stable.
- **How would you animate exit?** — Add a `leaving` flag: dismiss sets `leaving`, the item plays a CSS animation, and `onAnimationEnd` dispatches the actual removal.

## Common Mistakes
- Putting `toasts` in the same context as `show`, re-rendering every consumer on every toast.
- Starting the timer in `show()` — queued toasts expire before they are ever seen.
- Using the array index as the key, so removing the first toast remounts the others and resets their timers.
- Forgetting `clearTimeout` on unmount, causing dismiss calls for already-removed toasts.

## Tips
- Say the architecture in one line: **"context for the API, reducer for the list, each toast owns its timer."**
- Mention `useSyncExternalStore` for the "call it from anywhere" follow-up — it shows you know how real libraries work.
