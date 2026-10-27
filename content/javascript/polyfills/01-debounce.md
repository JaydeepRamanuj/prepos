---
title: "Implement debounce from scratch"
level: hard
type: implement
tags: [debounce, closures, timers, polyfill]
related: [javascript/throttle, react/use-debounce]
---

## Question
Write a `debounce(fn, wait)` function. The returned function should delay calling `fn` until `wait` milliseconds have passed since the **last** call. It must preserve `this` and the arguments of the latest call.

Then extend it with:
1. a `cancel()` method, and
2. an `{ leading: true }` option that fires on the first call of a burst instead of the last.

```js
const onResize = debounce(() => console.log("resized"), 200);
window.addEventListener("resize", onResize);
```

## Clues
- You need state that survives between calls of the returned function. What language feature gives you private, persistent state?
- On every call, throw away the previously scheduled call and schedule a fresh one.
- For `leading`, fire immediately only when no timer is currently pending — and use the timer purely as a "cool-down" window.

## Interview Answer
Debounce groups a burst of calls into one. I return a wrapper function that closes over a `timerId`. Every time the wrapper is called, I clear the pending timer and start a new one for `wait` ms; only when the calls stop for that long does the timer fire and call `fn` with the latest `this` and arguments. I use a regular `function` for the wrapper so `this` is whatever the caller used, and I attach a `cancel` method that clears the timer. For the leading variant I call `fn` immediately when no timer is pending and use the timer only as a cool-down, so the next burst can fire again after `wait` ms of silence.

## Explanation
### The core idea
Debounce answers "call this once the user has stopped doing something". Typical uses: search-as-you-type, resize/scroll handlers that do heavy work, autosave.

```txt
calls:   x x x x       x x        x
time:  ──────────────────────────────▶
fires:          ↑ (wait after last)  ↑ ...
```

### Trailing debounce (the default)

```js
function debounce(fn, wait) {
  let timerId; // private state, kept alive by the closure

  function debounced(...args) {
    // `this` is the caller's this, because `debounced` is a regular function
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      // arrow function → `this` and `args` come from the latest call
      fn.apply(this, args);
    }, wait);
  }

  debounced.cancel = () => {
    clearTimeout(timerId);
    timerId = undefined;
  };

  return debounced;
}
```

Why each piece matters:

- **Closure over `timerId`** — every call of `debounced` sees the same variable, so it can cancel the previous timer.
- **`function`, not arrow, for `debounced`** — an arrow would capture `this` from where `debounce` was *defined*, breaking methods like `obj.save = debounce(obj.save, 300)`.
- **Arrow inside `setTimeout`** — inherits `this` and `args` from that specific call. Because each call overwrites the timer, the call that finally fires is always the latest one.
- **`clearTimeout(undefined)`** is a safe no-op, so no `if` is needed.

### Adding `leading`

```js
function debounce(fn, wait, { leading = false } = {}) {
  let timerId;

  function debounced(...args) {
    const isColdStart = timerId === undefined;
    clearTimeout(timerId);

    if (leading) {
      if (isColdStart) fn.apply(this, args); // fire at the start of a burst
      // keep extending the cool-down while calls keep coming
      timerId = setTimeout(() => (timerId = undefined), wait);
      return;
    }

    timerId = setTimeout(() => {
      timerId = undefined;
      fn.apply(this, args);
    }, wait);
  }

  debounced.cancel = () => {
    clearTimeout(timerId);
    timerId = undefined;
  };

  return debounced;
}
```

The trick is resetting `timerId` to `undefined` when the timer completes — that is how the next call knows a new burst has started.

### Debounce vs throttle

| | Debounce | Throttle |
|---|---|---|
| Fires | after calls stop for `wait` | at most once per `wait` while calls continue |
| Good for | search input, autosave, resize end | scroll position, drag, mousemove analytics |

### Using it in React
Creating the debounced function inside a component body makes a new one every render, so the timer never accumulates. Keep it stable with `useMemo`/`useRef` (or a `useDebounce` value hook), and cancel it on unmount:

```tsx
const save = useMemo(() => debounce((v: string) => api.save(v), 500), []);
useEffect(() => () => save.cancel(), [save]);
```

## Follow-ups
- **How would you return a value from the debounced function?** — Return a promise that resolves with `fn`'s result when the timer fires; earlier callers in the burst either share that promise or get rejected/ignored — decide and document it.
- **What is `maxWait`?** — Lodash's option that guarantees `fn` runs at least once every `maxWait` ms during a continuous burst; combining it with debounce effectively gives you throttle.
- **How do you test it without waiting real time?** — Use fake timers (`vi.useFakeTimers()` / `jest.useFakeTimers()`) and advance them manually.

## Common Mistakes
- Using an arrow function for the returned wrapper, which loses the caller's `this`.
- Declaring `timerId` inside the wrapper, so every call gets a fresh variable and nothing is ever cancelled.
- Calling `fn` with the *first* call's arguments instead of the latest.
- In React, calling `debounce()` during render so a new instance is created on every keystroke.

## Tips
- Say the one-line definition first ("run once the calls stop for `wait` ms"), then write the 8-line trailing version — that alone passes most interviews. Add `cancel` and `leading` only if asked.
- Mnemonic: **clear, then set** — every call clears the old timer and sets a new one.
