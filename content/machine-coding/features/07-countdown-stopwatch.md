---
title: "Build a countdown timer and stopwatch that stay accurate"
level: medium
type: implement
tags: [timers, setInterval, useEffect, requestAnimationFrame, drift, cleanup, custom-hooks]
related: [machine-coding/otp-input, react/use-effect-cleanup, javascript/event-loop-basics]
---

## Question
Build two components: a `Countdown` (start from a number of seconds, pause, resume, reset) and a `Stopwatch` (start, stop, lap, reset) showing `mm:ss.cs`.

**Must-haves**
- Start, pause/resume and reset work repeatedly.
- No leaked intervals when unmounting or restarting.
- The countdown stops at zero and calls `onComplete` once.
- Time stays accurate even if the tab is throttled in the background.

**Stretch goals**
- Laps list in the stopwatch.
- Persist a running timer across refresh.
- Announce completion to screen readers.

## Clues
- `setInterval` ticks are not guaranteed to be exactly 1000ms apart, so do not count ticks. Store a timestamp and compute elapsed time from `Date.now()` or `performance.now()`.
- Put the interval in an effect keyed on the `running` flag, and clear it in the cleanup.
- Pausing means saving the elapsed time so far, then restarting from that offset.

## Interview Answer
I never increment a counter per tick, because intervals drift and browsers throttle background tabs to about once a second or less. Instead I keep `startedAt` (a timestamp) and `accumulated` (milliseconds banked before the last pause). While running, an interval, or `requestAnimationFrame` for smooth centiseconds, just triggers a re-render, and the displayed value is `accumulated + (now - startedAt)`. Pause adds the current segment to `accumulated` and clears `startedAt`; reset zeroes both. The countdown shows `max(0, total - elapsed)` and fires `onComplete` when it reaches zero, with a ref guarding against calling it twice. The effect that owns the interval depends on `running` and clears the timer in cleanup, so unmounting or toggling cannot leak timers. I extract the logic into a `useStopwatch` hook, which both components use.

## Explanation
### Why timestamps
```txt
tick counting:   +1s, +1s, +1s …   background tab throttled to 1/min → clock falls behind
timestamps:      elapsed = now - startedAt   → correct no matter how late the tick is
```

### Hook

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

export function useStopwatch(tickMs = 50) {
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);                       // re-render trigger
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(0);

  const elapsed = () =>
    accumulated.current + (startedAt.current !== null ? performance.now() - startedAt.current : 0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), tickMs);
    return () => clearInterval(id);
  }, [running, tickMs]);

  const start = useCallback(() => {
    if (startedAt.current !== null) return;
    startedAt.current = performance.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAt.current === null) return;
    accumulated.current += performance.now() - startedAt.current;
    startedAt.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    accumulated.current = 0;
    setRunning(false);
  }, []);

  return { running, elapsed: elapsed(), start, pause, reset };
}

export function format(ms: number) {
  const total = Math.floor(ms / 10);                   // centiseconds
  const cs = String(total % 100).padStart(2, "0");
  const s = String(Math.floor(total / 100) % 60).padStart(2, "0");
  const m = String(Math.floor(total / 6000)).padStart(2, "0");
  return `${m}:${s}.${cs}`;
}
```

Reading refs during render is fine here because the render is triggered by `force`, and the value is derived from the clock. Treat it as an intentional escape hatch; the key point is that time is derived, not accumulated.

### Stopwatch with laps

```tsx
export function Stopwatch() {
  const { running, elapsed, start, pause, reset } = useStopwatch();
  const [laps, setLaps] = useState<number[]>([]);

  return (
    <div>
      <output aria-live="off">{format(elapsed)}</output>
      <button onClick={running ? pause : start}>{running ? "Stop" : "Start"}</button>
      <button onClick={() => setLaps((l) => [elapsed, ...l])} disabled={!running}>Lap</button>
      <button onClick={() => { reset(); setLaps([]); }}>Reset</button>
      <ol>{laps.map((t, i) => <li key={i}>{format(t)}</li>)}</ol>
    </div>
  );
}
```

### Countdown

```tsx
export function Countdown({ seconds, onComplete }: { seconds: number; onComplete?: () => void }) {
  const { running, elapsed, start, pause, reset } = useStopwatch(200);
  const remaining = Math.max(0, seconds * 1000 - elapsed);
  const done = useRef(false);

  useEffect(() => {
    if (remaining === 0 && running && !done.current) {
      done.current = true;
      pause();
      onComplete?.();
    }
  }, [remaining, running, pause, onComplete]);

  return (
    <div>
      <output>{format(remaining).slice(0, 5)}</output>
      <button onClick={running ? pause : start} disabled={remaining === 0}>{running ? "Pause" : "Start"}</button>
      <button onClick={() => { done.current = false; reset(); }}>Reset</button>
      {remaining === 0 && <p role="status">Time's up</p>}
    </div>
  );
}
```

### Pitfalls
- **Functional updates for ticks:** `setCount(c => c + 1)` avoids stale closures but still drifts; derive from a clock instead.
- **StrictMode:** effects run twice in development; the cleanup must fully undo the setup (it does).
- **`requestAnimationFrame`:** smoother for milliseconds but pauses in background tabs; timestamps make that harmless.
- **Persist across refresh:** store `startedAt` as `Date.now()` (wall clock, not `performance.now()`, which resets on page load) plus `accumulated`.
- **Accessibility:** do not announce every tick (`aria-live="off"`); announce only completion with `role="status"`.

## Follow-ups
- **Why `performance.now()` over `Date.now()`?** — It is monotonic and unaffected by system clock changes; use `Date.now()` only when you need wall-clock persistence.
- **How would you test it?** — Vitest fake timers (`vi.useFakeTimers`) with `vi.advanceTimersByTime`, mocking `performance.now`.

## Common Mistakes
- Counting ticks, so time drifts.
- Forgetting `clearInterval` in cleanup, producing duplicate intervals after restart.
- Calling `onComplete` repeatedly after reaching zero.

## Tips
- Say "derive from timestamps, don't accumulate ticks" first.
