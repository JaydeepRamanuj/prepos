---
title: "What are pure functions and side effects, and why do React and Redux care?"
level: medium
type: concept
tags: [functions, purity, side-effects, immutability, react]
related: [javascript/memoization, javascript/higher-order-functions, javascript/object-reference-output]
---

## Question
What makes a function pure? What counts as a side effect? Why do libraries like React and Redux insist that certain functions are pure?

## Interview Answer
A pure function always returns the same output for the same inputs and does nothing observable besides returning that value. It does not mutate its arguments or outer variables, and it does no I/O such as network calls, DOM writes, logging, timers, or reading `Date.now()` or `Math.random()`. Purity makes code predictable. I can test it without mocks, cache its result (memoization), run it twice safely, and reason about it locally. React relies on this. Components and reducers must be pure during render, so React can render them more than once (StrictMode does it on purpose), skip or interrupt renders, and the React Compiler can memoize them automatically. Side effects still have to happen, so I push them to the edges: event handlers, `useEffect`, Server Actions, or a service layer.

## Explanation
### The two rules
1. **Deterministic**: same inputs give the same output. Hidden inputs such as globals, `Date.now()` or `Math.random()` break this.
2. **No side effects**: nothing outside the function changes, and the function does not interact with the outside world.

```js
// Pure
const total = (items) => items.reduce((sum, i) => sum + i.price * i.qty, 0);

// Impure: mutates its input
function addItem(cart, item) {
  cart.items.push(item); // the caller's object changes
  return cart;
}

// Pure version: return a new object
const addItemPure = (cart, item) => ({ ...cart, items: [...cart.items, item] });

// Impure: hidden input
const isExpired = (token) => token.exp < Date.now();
// Pure version: make the hidden input an argument
const isExpiredAt = (token, now) => token.exp < now;
```

### Common side effects

| Kind | Examples |
|---|---|
| Mutation | changing arguments, outer variables, module state |
| I/O | `fetch`, `localStorage`, DOM updates, `console.log` |
| Time/randomness | `Date.now()`, `Math.random()`, `crypto.randomUUID()` |
| Scheduling | `setTimeout`, subscriptions |
| Throwing | debated, but it changes control flow for the caller |

### Why React cares
- **Render must be pure.** React may call your component several times before it commits, or throw away a render in concurrent mode. A render that fires a request or mutates a shared array would run that effect a random number of times.
- **StrictMode double-invokes** components, initialisers and reducers in development specifically to expose impure renders.
- **Change detection uses identity.** `setItems(items.push(x))` mutates the array in place and keeps the same reference, so React (and `memo`, `useMemo`, Redux selectors) see "no change". Immutable updates create new references that can be compared cheaply with `Object.is`.
- **The React Compiler** auto-memoizes on the assumption that components and hooks follow the rules of React, including purity.

### Functional core, imperative shell
The practical architecture is to keep business logic (pricing, validation, state transitions) in pure functions and keep effects in a thin outer layer.

```ts
// pure: easy to unit test
export function applyCoupon(cart: Cart, coupon: Coupon): Cart { /* ... */ }

// impure shell
async function onApply(code: string) {
  const coupon = await api.getCoupon(code);    // effect
  setCart((cart) => applyCoupon(cart, coupon)); // pure transition
}
```

## Follow-ups
- **Is a function that uses a local mutable variable impure?** — No. Mutating values the function created itself is invisible from outside, so the function is still pure.
- **What is referential transparency?** — You can replace a call with its result without changing program behaviour. Pure functions have this property.
- **Is `console.log` inside a reducer a problem?** — It is technically a side effect and harmless for debugging. Logs will appear twice in StrictMode, which tells you React is re-running it.

## Common Mistakes
- Treating "no network calls" as the full definition and forgetting that mutating an argument is a side effect.
- Using `array.sort()` or `array.reverse()` inside render. Both mutate in place. Use `toSorted()` / `toReversed()` or copy first.
- Believing pure means "no outer variables at all". Reading a constant is fine. Reading mutable outer state is what breaks determinism.

## Tips
- Tie the answer to a real consequence: "StrictMode double-renders to catch impurity" or "mutating state means React doesn't re-render". That shows you have hit the problem in practice.
