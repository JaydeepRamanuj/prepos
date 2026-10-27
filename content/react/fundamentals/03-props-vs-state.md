---
title: "Components, props and state — what is the difference between props and state?"
level: easy
type: concept
tags: [props, state, components, fundamentals]
related: [react/one-way-data-flow, react/use-state-functional-updates, react/you-might-not-need-an-effect]
---

## Question
What are props and what is state in React? When does a value belong in state, and when should it be a prop or simply computed?

## Interview Answer
Props are the inputs a parent passes to a component — read-only from the child's perspective, like function arguments. State is data a component owns and can change over time with a setter, and changing it schedules a re-render of that component and its children. Props flow down; state lives in the component that owns it. A value belongs in state only if it changes over time, can't be passed in from a parent, and can't be computed from existing props or state — otherwise it should be a prop or derived during render. Both are snapshots: during a render they are fixed values for that render.

## Explanation
### Side by side
| | Props | State |
|---|---|---|
| Owned by | Parent | The component itself |
| Mutable by the component? | No (read-only) | Yes, via the setter |
| Change causes re-render? | Yes, when the parent re-renders with new props | Yes, when the setter is called with a new value |
| Analogy | Function parameters | Variables that survive between calls |

```tsx
function Counter({ step }: { step: number }) {   // step: prop
  const [count, setCount] = useState(0);          // count: state
  const isEven = count % 2 === 0;                 // derived: neither
  return (
    <button onClick={() => setCount((c) => c + step)}>
      {count} {isEven ? "(even)" : ""}
    </button>
  );
}
```

### Deciding where data lives
Ask three questions:
1. Does it stay the same forever? → not state (a constant or prop).
2. Is it passed in from a parent? → prop.
3. Can you compute it from props/state? → derive it in render.

What survives all three is state. The most common smell is *duplicated* state — e.g. storing `fullName` alongside `firstName` and `lastName` and syncing them with an effect. Compute it instead.

### Copying a prop into state
```tsx
function Message({ color }: { color: string }) {
  const [c] = useState(color); // only uses the *initial* color
}
```
`useState(initial)` reads its argument once. Later prop changes are ignored, which looks like a bug. Only do this intentionally (and name it `initialColor`).

### Snapshots
In a render, `count` is a constant. Calling `setCount` doesn't change the variable you're holding; it asks React for a new render where `useState` returns the new value.

## Follow-ups
- **Can a child change its props?** — No. It asks the parent to change them by calling a callback prop the parent passed down.
- **Where do you put state shared by two siblings?** — Lift it up to their closest common parent and pass it down as props.

## Common Mistakes
- Mutating props (`props.items.push(x)`) — breaks purity and React won't know anything changed.
- Mirroring props into state and then fighting to keep them in sync.
- Storing derived values (filtered lists, totals) in state.

## Tips
- Use the "three questions" checklist out loud; interviewers like hearing a decision rule rather than definitions.
