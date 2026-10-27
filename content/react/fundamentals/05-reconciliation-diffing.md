---
title: "How does React's reconciliation (diffing) algorithm work?"
level: advanced
type: concept
tags: [reconciliation, diffing, fiber, keys, state-preservation]
related: [react/index-as-key, react/render-and-commit, react/jsx-compiles-to]
---

## Question
A full tree diff is O(n³). How does React compare the old and new element trees in roughly O(n)? What heuristics does it use, and how do they decide whether a component's state is preserved or reset?

## Clues
- React never tries to find the "minimal edit" between two arbitrary trees. What two assumptions let it skip that?
- Think about what happens when `<Counter />` is rendered at the same spot vs when a `<div>` around it becomes a `<section>`.
- State is tied to a position in the tree, not to the component function.

## Interview Answer
React uses two heuristics. First, elements of different types produce different trees: if the type at a position changes — `div` to `section`, or `ComponentA` to `ComponentB` — React tears down the whole subtree, including its state, and mounts a new one, without trying to match children inside it. Second, among a list of siblings, a `key` tells React which child is which across renders, so it can move items instead of recreating them. With those rules React walks both trees once, comparing at the same position level by level, which is linear. The practical consequence is that state belongs to a *position* in the tree, identified by type plus key: same type at the same position keeps state; changing type or key resets it. Since React 16 this work is done on the Fiber tree, which lets rendering be split into units and interrupted.

## Explanation
### The two heuristics
```txt
Rule 1: different type at same position  ──▶ unmount old subtree, mount new one
Rule 2: same type at same position       ──▶ keep instance (and state), update props, recurse
Lists : children matched by key (or by index if no key)
```

### Same type, same position → state preserved
```tsx
function App({ isFancy }: { isFancy: boolean }) {
  return isFancy ? <Counter fancy /> : <Counter />;
}
```
Both branches put a `Counter` at the same position, so toggling `isFancy` keeps the count. React sees "same type, new props".

### Different type → state reset
```tsx
function App({ paused }: { paused: boolean }) {
  return paused ? <p>Paused</p> : <Counter />;
}
```
Switching to `<p>` and back mounts a fresh `Counter` with count 0. The same happens with wrappers:

```tsx
return isFancy ? <div><Counter /></div> : <section><Counter /></section>;
```
`div` vs `section` differs at the parent, so the entire subtree — including `Counter` — remounts.

### The nested-component trap
```tsx
function Parent() {
  function Input() { return <input />; }   // ❌ new function every render
  return <Input />;
}
```
Each render creates a new `Input` function, so the type changes every time; React remounts the input on every keystroke and focus is lost. Define components at module top level.

### Keys as identity (and as a reset button)
Keys let React match children independent of order. They also let you deliberately reset state:

```tsx
<ProfileForm key={userId} userId={userId} />
```
When `userId` changes, the key changes, so React treats it as a different component and resets all internal state — far cleaner than an effect that clears fields.

### Host element updates
For two DOM elements of the same type, React keeps the node and only patches changed attributes and styles, then recurses into children.

### Where Fiber fits
Fiber is the internal data structure — one fiber per element, linked as child/sibling/return — that holds state, effects and work. It lets React split reconciliation into small units, pause for urgent work, and resume, which powers Transitions and Suspense. The diffing rules above stay the same.

## Follow-ups
- **Why not compute the true minimal diff?** — It's O(n³), and in real UIs subtrees of different types rarely share structure, so the heuristics are almost always right.
- **What happens when you conditionally render two components of the same type in different branches?** — They share the slot and therefore the state, unless you give them different keys.
- **Is the virtual DOM the same as Fiber?** — "Virtual DOM" is an informal term for the element tree; Fiber is React's implementation of the work tree that reconciliation runs on.

## Common Mistakes
- Saying React "compares with the real DOM" — it compares old and new element/fiber trees.
- Defining components inside other components, causing remounts and lost focus.
- Using an effect to reset state when a `key` would do it.

## Tips
- Memorise the phrase "state is tied to type + position (+ key)". Then use the `key={userId}` reset trick as a practical example — interviewers love it.
