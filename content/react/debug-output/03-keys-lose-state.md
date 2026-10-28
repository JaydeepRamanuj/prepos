---
title: "What renders? Keys, identity and state that disappears or sticks"
level: hard
type: output
tags: [keys, reconciliation, state-reset, component-identity, output]
related: [react/index-as-key, react/reconciliation-diffing, react/render-and-commit]
---

## Question
Predict the behaviour in each scenario, then explain how React decides.

```tsx
function Field({ label }: { label: string }) {
  const [text, setText] = useState("");
  return <label>{label} <input value={text} onChange={(e) => setText(e.target.value)} /></label>;
}

// 1
function A({ isFirst }: { isFirst: boolean }) {
  return isFirst ? <Field label="First" /> : <Field label="Second" />;
}

// 2
function B({ isFirst }: { isFirst: boolean }) {
  return isFirst ? <Field key="a" label="First" /> : <Field key="b" label="Second" />;
}

// 3
function C({ users }: { users: string[] }) {
  return <ul>{users.map((u, i) => <li key={i}><Field label={u} /></li>)}</ul>;
}   // user removes the first item from the list

// 4
function D({ isFirst }: { isFirst: boolean }) {
  return (
    <div>
      {isFirst && <p>Hint</p>}
      <Field label="Name" />
    </div>
  );
}

// 5
function E() {
  function Inner() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>{n}</button>; }
  const [tick, setTick] = useState(0);
  return <><button onClick={() => setTick(tick + 1)}>re-render</button><Inner /></>;
}
```

## Clues
- React preserves state when the component type and position in the tree stay the same.
- A different `key` forces a remount, resetting state.
- A component defined inside another component is a new type on each render.

## Interview Answer
In 1, state is kept: both branches render the same component type at the same position, so only the `label` prop changes and the typed text stays. In 2, the keys differ, so React unmounts and mounts a new `Field` and the text resets. In 3, index keys mean that removing the first user shifts everything: item 0 now holds the second user's label but keeps the first item's state, so typed text appears under the wrong user. In 4, `isFirst && <p>` renders `false` in the slot when hidden, so the `Field`'s position is stable and its state is preserved. In 5, `Inner` is redefined on every render of `E`, so each re-render creates a new component type, React unmounts and remounts it, and the counter resets to 0 every time.

## Explanation
### How React matches
React compares the previous and next element at each position: same type and key means update (keep state); different type or key means unmount and mount (reset state).

| # | Result | Reason |
|---|---|---|
| 1 | state preserved | same type, same position, no keys |
| 2 | state reset | different `key` → new identity |
| 3 | state attaches to wrong rows | index keys don't identify items |
| 4 | state preserved | conditional renders `false` (a placeholder), siblings keep positions |
| 5 | counter resets on every parent render | component type recreated each render |

### Using keys deliberately
- Stable, unique ids from data for lists (`key={user.id}`).
- Change the `key` intentionally to reset a subtree: `<ProfileForm key={userId} />` is the recommended way to reset state when a prop identity changes.

### Case 3 in detail

```txt
before: [Ann(typed "x"), Bob, Cy]   keys 0,1,2   state: 0→"x"
remove Ann:
after:  [Bob, Cy]                   keys 0,1     state: 0 still "x" -> shown next to Bob
```

With `key={u.id}`, Ann's state is discarded with her row.

### Case 4 subtlety
If instead you wrote `{isFirst ? <p>Hint</p> : null}` the same applies: `null` occupies the slot. But `{isFirst && <p/>}` followed by conditional wrappers that change element type (for example, `<div>` vs `<section>` around `Field`) would reset state.

### Case 5 fix
Move `Inner` outside `E`, or pass it props. Defining components inside components also breaks memoisation and focus (inputs lose focus on each keystroke).

## Follow-ups
- **How do you reset a form when the selected user changes?** — Use `key={user.id}` on the form.
- **Does changing `key` re-run effects?** — Yes; it unmounts and mounts, running cleanups and effects.

## Common Mistakes
- Index keys in dynamic lists.
- Generating keys with `Math.random()` (remounts every render).
- Declaring components inside render.

## Tips
- Phrase it as "identity = type + position + key".
