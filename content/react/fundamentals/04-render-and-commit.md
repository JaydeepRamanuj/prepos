---
title: "Explain the render and commit phases in React"
level: medium
type: concept
tags: [rendering, commit, fiber, effects, purity]
related: [react/reconciliation-diffing, react/use-layout-effect-vs-use-effect, react/strict-mode-double-invoke]
---

## Question
"Rendering" in React does not mean painting pixels. Walk me through what happens from a `setState` call to the user seeing the update. What are the render and commit phases, and why must rendering be pure?

## Interview Answer
An update goes through three steps: trigger, render, commit. A trigger is the initial `root.render` or a state update. In the render phase React calls my component functions to get the new element tree and diffs it against the previous one — this is pure computation, touches no DOM, and in concurrent features React may pause, throw away or repeat it. In the commit phase React applies the calculated changes to the DOM synchronously, attaches refs, and runs layout effects; then the browser paints, and after that regular `useEffect`s run. Because render can happen more than once or be discarded, components must be pure: same inputs, same output, no side effects — side effects belong in event handlers or effects.

## Explanation
### The pipeline
```txt
 trigger            render phase                    commit phase                    browser
setState ──▶ call components, build new tree ──▶ mutate DOM, set refs,      ──▶  paint  ──▶ useEffect
             diff vs previous (reconcile)         run useLayoutEffect                      callbacks
             (interruptible, may repeat)          (synchronous, not interruptible)
```

### Render phase
- React calls the component that triggered the update **and all its descendants** (unless they bail out, e.g. `memo` with equal props).
- Output is React elements; React reconciles them to find what changed.
- With concurrent rendering (Transitions, Suspense), React can start rendering, yield to the browser for urgent input, and restart later. That only works if rendering has no observable side effects.

### Commit phase
- React applies the minimal DOM operations (insert, update attributes/text, remove).
- If the output is identical, the DOM is not touched at all — re-rendering is not the same as re-painting.
- Ref callbacks/objects are attached, layout effect cleanups and setups run synchronously, before paint.

### After paint
Passive effects (`useEffect`) run, usually after the browser paints so they don't block the frame. Children's effects run before the parent's.

### Why purity matters
```tsx
let guests = 0;
function Cup() {
  guests++;               // ❌ side effect during render
  return <p>Tea for guest #{guests}</p>;
}
```
Render `<Cup />` three times and in development (StrictMode double-invokes render) you'd see 2, 4, 6. A pure version takes `guest` as a prop. Rules of thumb during render: don't mutate pre-existing variables/props/state, don't fetch, don't set timers, don't read/write `ref.current` (except lazy init).

### What triggers a re-render
- Its own state changed (`setState` with a value not `Object.is`-equal to current).
- Its parent re-rendered (props don't need to change!).
- A context it reads changed.

## Follow-ups
- **Does a re-render always mean a DOM update?** — No. React diffs; unchanged output means no DOM work.
- **Where does `useLayoutEffect` run?** — In the commit phase after DOM mutation but before paint, which is why it can measure layout without flicker but also blocks painting.
- **Can render run without a commit?** — Yes: an interrupted Transition or a suspended render can be thrown away.

## Common Mistakes
- Equating "render" with "DOM update".
- Believing components re-render only when props change — a parent re-render re-renders children by default.
- Putting side effects (analytics, fetches) in the component body.

## Tips
- Draw the pipeline with the paint step between layout effects and `useEffect`; it answers several follow-ups at once.
