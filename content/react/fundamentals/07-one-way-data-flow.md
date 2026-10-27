---
title: "What is one-way data flow, and how do children update a parent's state?"
level: medium
type: concept
tags: [data-flow, lifting-state, props, callbacks]
related: [react/props-vs-state, react/use-context-rerenders, react/use-reducer-vs-use-state]
---

## Question
React is said to have "one-way data flow". What does that mean? Two sibling components need the same piece of data — how do you share it, and how does a child change it?

## Interview Answer
One-way data flow means data moves down the tree through props; a child can't reach up and change a parent's data. If a child needs to cause a change, the parent passes down a callback, and the child calls it — so events flow up, data flows down. To share data between siblings, I lift the state to their closest common parent, which owns it and passes the value and an updater to each child. This keeps a single source of truth, makes it easy to trace where any value comes from, and avoids the sync bugs of two-way binding. When lifting would mean passing props through many layers, I'd consider composition (passing components as `children`) or context.

## Explanation
### Lifting state up
```tsx
function Panel({ title, isActive, onShow, children }: {
  title: string;
  isActive: boolean;
  onShow: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3>{title}</h3>
      {isActive ? <p>{children}</p> : <button onClick={onShow}>Show</button>}
    </section>
  );
}

export function Accordion() {
  const [activeIndex, setActiveIndex] = useState(0); // single source of truth
  return (
    <>
      <Panel title="About" isActive={activeIndex === 0} onShow={() => setActiveIndex(0)}>
        PrepOS helps you prepare.
      </Panel>
      <Panel title="Pricing" isActive={activeIndex === 1} onShow={() => setActiveIndex(1)}>
        Free while in beta.
      </Panel>
    </>
  );
}
```
If each `Panel` owned its own `isActive` state, opening one couldn't close the other. Moving the state up makes `Panel` *controlled* by its parent.

```txt
            Accordion  (activeIndex)
            │ props ▼         ▲ onShow()
     Panel(isActive)     Panel(isActive)
```

### Why one-way?
- **Predictability** — to find why something changed, follow props up to the owner.
- **No sync loops** — two-way binding (as in old AngularJS) lets model and view update each other, which can cascade unpredictably.
- **Clear ownership** — each piece of state has exactly one component allowed to change it.

### Controlled inputs are the same idea
`<input value={text} onChange={(e) => setText(e.target.value)} />` — the value flows down, the change event flows up. React doesn't sync them automatically.

### When props drilling hurts
- First try **composition**: pass JSX as `children` so intermediate components don't need to know about the data.
- Then **context** for widely needed values (theme, user, locale).
- For complex shared client state, a store (Zustand) — but the flow is still one-directional: read from store, dispatch to change.

## Follow-ups
- **Isn't calling a parent's callback "two-way"?** — No; the child still doesn't own or mutate the data. It sends an event; the owner decides what to do.
- **Where should state live?** — In the lowest common ancestor of every component that needs it — no higher.

## Common Mistakes
- Mutating a prop object in a child and expecting the parent to update.
- Lifting state too high (to the app root), causing large re-renders.
- Reaching for context or a global store before trying composition.

## Tips
- The phrase "data down, events up" plus the accordion example is a complete answer in under a minute.
