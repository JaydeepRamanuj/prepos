---
title: "Build a Progress Bar and a Stepper component"
level: medium
type: implement
tags: [progress-bar, stepper, aria, derived-state, timers]
related: [machine-coding/form-wizard, machine-coding/countdown-stopwatch]
---

## Question
Part 1 — build a `ProgressBar` that takes `value` (0–100) and animates smoothly when the value changes. Demo it with a button that "uploads a file" by increasing progress on an interval until 100%.

Part 2 — build a `Stepper` for a checkout flow: `Cart → Address → Payment → Review`.

**Must-haves**
- Stepper shows each step's status: completed, current, upcoming.
- Next/Back buttons; Back disabled on the first step, Next becomes "Finish" on the last.
- A connector line between steps whose fill reflects progress.
- Both components expose correct ARIA (`role="progressbar"`, `aria-current="step"`).

**Stretch goals**
- Clicking a completed step jumps back to it; upcoming steps are not clickable.
- Vertical orientation.
- Multiple progress bars queued so only N run at a time.

## Interview Answer
I would treat these as two presentational components with the minimum state living in the parent. The progress bar is stateless — it receives `value`, clamps it, and renders an inner div with `transform: scaleX(value/100)` and a CSS transition, plus `role="progressbar"` and `aria-valuenow`. For the stepper, the only state is `currentIndex`; each step's status is derived by comparing its index to the current one, so there is no `completed` array to keep in sync. Next and Back just increment and decrement with bounds checks. The connector fill is derived too: `currentIndex / (steps.length - 1)`. For the demo upload I would use `setInterval` in an effect with proper cleanup, and use the functional state update so the interval never reads stale progress.

## Explanation
### Component tree
```txt
App
 ├─ UploadDemo (progress state + interval)
 │    └─ ProgressBar value
 └─ Checkout (currentIndex state)
      └─ Stepper steps currentIndex onStepClick
```

### Progress bar

```tsx
// ProgressBar.tsx
type Props = { value: number; label?: string };

export function ProgressBar({ value, label = "Progress" }: Props) {
  const pct = Math.min(100, Math.max(0, value)); // clamp bad input
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}
    >
      <div
        style={{
          height: "100%",
          background: "#2563eb",
          transformOrigin: "left",
          transform: `scaleX(${pct / 100})`,
          transition: "transform 300ms ease-out",
        }}
      />
    </div>
  );
}
```

Why `transform: scaleX` and not `width`? Animating `width` triggers layout on every frame; `transform` is composited by the GPU and stays smooth even when the main thread is busy. It is a small detail that interviewers notice.

### Upload demo — the interval done right

```tsx
// UploadDemo.tsx
import { useEffect, useState } from "react";
import { ProgressBar } from "./ProgressBar";

export function UploadDemo() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      // functional update: always reads the latest progress, never a stale closure
      setProgress((p) => {
        const next = Math.min(100, p + Math.random() * 15);
        if (next === 100) setRunning(false);
        return next;
      });
    }, 300);
    return () => clearInterval(id); // stops on finish and on unmount
  }, [running]);

  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 320 }}>
      <ProgressBar value={progress} label="Uploading report.pdf" />
      <span aria-live="polite">{progress === 100 ? "Upload complete" : `${Math.round(progress)}%`}</span>
      <button
        type="button"
        disabled={running}
        onClick={() => {
          setProgress(0);
          setRunning(true);
        }}
      >
        {progress === 100 ? "Upload again" : "Start upload"}
      </button>
    </div>
  );
}
```

### Stepper

```tsx
// Stepper.tsx
type Props = {
  steps: string[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
};

type Status = "completed" | "current" | "upcoming";

const statusOf = (i: number, current: number): Status =>
  i < current ? "completed" : i === current ? "current" : "upcoming";

export function Stepper({ steps, currentIndex, onStepClick }: Props) {
  const fill = steps.length > 1 ? currentIndex / (steps.length - 1) : 1;

  return (
    <nav aria-label="Checkout progress" style={{ position: "relative" }}>
      {/* Connector track + fill, behind the circles */}
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, height: 2, background: "#e5e7eb" }}>
        <div
          style={{
            height: "100%",
            background: "#2563eb",
            transformOrigin: "left",
            transform: `scaleX(${fill})`,
            transition: "transform 300ms",
          }}
        />
      </div>

      <ol style={{ display: "flex", justifyContent: "space-between", listStyle: "none", padding: 0, margin: 0, position: "relative" }}>
        {steps.map((label, i) => {
          const status = statusOf(i, currentIndex);
          const clickable = status === "completed" && onStepClick;
          return (
            <li key={label} aria-current={status === "current" ? "step" : undefined} style={{ textAlign: "center" }}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(i)}
                aria-label={`${label}, ${status}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "2px solid #2563eb",
                  background: status === "upcoming" ? "white" : "#2563eb",
                  color: status === "upcoming" ? "#2563eb" : "white",
                }}
              >
                {status === "completed" ? "✓" : i + 1}
              </button>
              <div style={{ fontSize: 12, fontWeight: status === "current" ? 700 : 400 }}>{label}</div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

```tsx
// App.tsx
import { useState } from "react";
import { Stepper } from "./Stepper";
import { UploadDemo } from "./UploadDemo";

const STEPS = ["Cart", "Address", "Payment", "Review"];

export default function App() {
  const [current, setCurrent] = useState(0);
  const isLast = current === STEPS.length - 1;

  return (
    <main style={{ display: "grid", gap: 32, maxWidth: 480, padding: 24 }}>
      <UploadDemo />
      <section style={{ display: "grid", gap: 16 }}>
        <Stepper steps={STEPS} currentIndex={current} onStepClick={setCurrent} />
        <h2>{STEPS[current]}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? alert("Order placed") : setCurrent((c) => c + 1))}
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </section>
    </main>
  );
}
```

### Why everything is derived
| Value | Derived from |
|---|---|
| step status | `i` vs `currentIndex` |
| connector fill | `currentIndex / (n - 1)` |
| Next label | `currentIndex === n - 1` |
| Back disabled | `currentIndex === 0` |

If you stored a `completed: boolean[]`, jumping back to step 1 would require remembering to un-complete steps 2–3 — a classic sync bug. Derive it instead. (If the product needs "visited but not valid" steps, *then* you add explicit state — that is the form wizard question.)

### Accessibility
- Progress bar: `role="progressbar"`, `aria-valuenow/min/max`, an accessible name. A visually hidden `aria-live="polite"` text announces completion; do not announce every percentage change or screen readers become noisy.
- Stepper: an `<ol>` (order matters), `aria-current="step"` on the current item, and real buttons for clickable steps. Upcoming steps are `disabled`.

### Edge cases
- `value` below 0 or above 100 → clamped.
- Indeterminate progress (unknown total) → omit `aria-valuenow` and show a looping animation.
- Single-step stepper → avoid divide-by-zero (`steps.length > 1 ? … : 1`).
- Interval still running when the component unmounts → effect cleanup clears it.

## Follow-ups
- **Why not use the native `<progress>` element?** — You can; it has built-in semantics. Styling it consistently across browsers needs vendor pseudo-elements, which is why many teams build a div version with ARIA.
- **How would you limit concurrent uploads to N bars?** — Keep a queue of pending jobs and a `running` count; when a job finishes, start the next one. This is the "promise pool / concurrency limiter" pattern.
- **Where would real upload progress come from?** — `fetch` does not expose upload progress; use `XMLHttpRequest`'s `upload.onprogress` (`loaded / total`).

## Common Mistakes
- `setProgress(progress + 10)` inside `setInterval` — the closure captures the first render's `progress`, so it gets stuck at 10.
- No cleanup for the interval → it keeps running after unmount and you see "state update on unmounted component" style bugs and leaks.
- Animating `width` instead of `transform`.
- Storing step statuses in state instead of deriving them.

## Tips
- Say "derive, don't store" early — the whole stepper is one integer of state.
- For any interval in React, recite: **functional update + cleanup**.
