---
title: "Lifting state up vs colocating state: how do you decide where state lives?"
level: easy
type: concept
tags: [state, lifting-state, colocation, data-flow]
related: [react/one-way-data-flow, react/state-colocation, react/children-slots, react/use-context-rerenders]
---

## Question
Two sibling components, a filter input and a results list, need to share the filter text. Where should the state live? What is the cost of lifting state too high?

## Interview Answer
State belongs in the lowest common ancestor of every component that reads or changes it. For the filter and the list, that's their parent: it holds the state, passes the value down as props, and passes a setter or callback to the input. This is "lifting state up". The opposite rule matters too: keep state as close as possible to where it's used (colocation). State lifted too high makes every change re-render a large subtree, forces prop drilling, and couples unrelated components. So I start local, lift only when a sibling needs it, and if lifting becomes deep, I use composition (pass elements as children) or context for low-frequency data.

## Explanation
### Before: duplicated state

```tsx
function Filter() {
  const [text, setText] = useState("");
  return <input value={text} onChange={(e) => setText(e.target.value)} />;
}
function Results() {
  const [text] = useState("");        // cannot see Filter's state
  // ...
}
```

### After: lifted

```tsx
function Products({ products }: { products: Product[] }) {
  const [text, setText] = useState("");
  const visible = products.filter((p) => p.name.includes(text));   // derived, not stored

  return (
    <>
      <Filter value={text} onChange={setText} />
      <Results items={visible} />
    </>
  );
}

function Filter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}
```

The filtered list is derived during render, not stored as extra state.

### Decision guide

| Situation | Action |
|---|---|
| Only one component uses it | keep it local |
| Siblings need it | lift to the closest common parent |
| Cousins far apart | consider composition, then context, then a store |
| Needs to survive navigation/reload | URL, storage or server |
| Server data | query library / server components, not component state |

### Too-high state symptoms
- Typing in one input re-renders the whole page.
- Props are passed through components that don't use them.
- Components can't be reused without their parent's state.

### Fix by moving state down
If only part of the tree uses fast-changing state, extract that part into its own component with its own state, or pass the heavy remainder as `children` so it doesn't re-render.

### Controlled components
Lifting state is what makes inputs "controlled": the parent owns the value; the child receives `value` and `onChange`.

## Follow-ups
- **What if the same state is needed in many distant places?** — Context or a store like Zustand.
- **Where does the URL fit?** — Shareable state like filters and pagination often belongs in the URL.

## Common Mistakes
- Storing derived data in state (filtered list).
- Lifting everything to the app root.
- Duplicating state in two places and syncing with effects.

## Tips
- State both rules: lift when shared, colocate otherwise.
