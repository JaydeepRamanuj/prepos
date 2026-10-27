---
title: "Implement throttle from scratch"
level: hard
type: implement
tags: [throttle, closures, timers, polyfill]
related: [javascript/debounce, react/use-debounce, javascript/closure]
---

## Question
Write `throttle(fn, wait)` that calls `fn` at most once every `wait` ms, however often the returned function is called. The first call should run immediately (leading), and the last call in a burst should run once the window ends (trailing). Preserve `this` and arguments, and provide `cancel()`.

```js
const onScroll = throttle(() => console.log("scrolled"), 200);
window.addEventListener("scroll", onScroll);
```

## Clues
- Remember the time of the last execution, or use a timer as a cool-down window.
- Calls that arrive during the window should not be lost entirely: keep the latest arguments for a trailing call.
- Compare with debounce: throttle guarantees regular execution during continuous activity.

## Interview Answer
Debounce waits for silence; throttle limits the rate. I keep closure state: the time of the last run, a pending timer and the latest `this`/args. On each call I compute the remaining time in the window. If the window has elapsed, I run `fn` immediately and record the time. Otherwise I store the latest arguments and, if no trailing timer exists, schedule one for the remaining time so the final call in the burst is not dropped. `cancel` clears the timer and resets state. Throttle suits scroll, resize, mousemove and rate-limited API calls.

## Explanation
### Throttle vs debounce

```txt
calls:      x x x x x x x x x x
throttle:   ^     ^     ^     ^      (at most once per window, regularly)
debounce:                       ^    (once, after calls stop)
```

### Implementation (leading + trailing)

```js
function throttle(fn, wait) {
  let lastCall = 0;
  let timerId = null;
  let lastArgs;
  let lastThis;

  function invoke() {
    lastCall = Date.now();
    timerId = null;
    fn.apply(lastThis, lastArgs);
    lastArgs = lastThis = undefined;
  }

  function throttled(...args) {
    lastArgs = args;
    lastThis = this;
    const remaining = wait - (Date.now() - lastCall);

    if (remaining <= 0) {
      clearTimeout(timerId);       // a pending trailing call is replaced by this one
      invoke();                    // leading edge or window already over
    } else if (!timerId) {
      timerId = setTimeout(invoke, remaining);   // trailing edge
    }
  }

  throttled.cancel = () => {
    clearTimeout(timerId);
    timerId = null;
    lastCall = 0;
    lastArgs = lastThis = undefined;
  };

  return throttled;
}
```

### Walkthrough (wait = 100)
- t=0: first call, `remaining` ≤ 0 (lastCall = 0) → runs immediately.
- t=30, 60: inside window → args saved; one timer scheduled for t=100.
- t=100: timer fires with the latest args (from t=60).
- t=250: new call, window long over → runs immediately.

### Simpler timestamp-only version
Only leading edge, no trailing call:

```js
function throttleLeading(fn, wait) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      return fn.apply(this, args);
    }
  };
}
```

### Edge cases
- Use `performance.now()` if clock changes matter; `Date.now()` can jump.
- For animations prefer `requestAnimationFrame` throttling.
- Return value: a throttled function cannot synchronously return the result of a delayed call.
- In React, create the throttled function once (`useRef` / `useMemo`) or it is recreated every render.

### Complexity
O(1) time and space per call.

## Follow-ups
- **When would you pick throttle over debounce?** — Continuous feedback needed during activity (scroll position, drag), or enforcing a rate limit.
- **What does Lodash add?** — `leading`/`trailing` options and `flush`.

## Common Mistakes
- Using only a timer flag and losing the last event.
- Recreating the throttled function on every render.

## Tips
- Draw the three-line timeline (calls, throttle, debounce); it makes the difference obvious.
