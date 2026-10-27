---
title: "Why doesn't the UI update? Mutating state, same references and missing keys"
level: medium
type: debugging
tags: [state-mutation, immutability, re-render, arrays, objects]
related: [javascript/object-immutability-freeze, javascript/mutating-vs-non-mutating-array-methods, react/props-vs-state, react/react-memo-new-props]
---

## Question
Each handler "works" in the console but the UI doesn't update, or updates incorrectly. Explain why and fix each.

```tsx
function Cart() {
  const [items, setItems] = useState<Item[]>([{ id: 1, qty: 1 }]);
  const [user, setUser] = useState({ name: "Asha", address: { city: "Pune" } });

  function add() {
    items.push({ id: Date.now(), qty: 1 });
    setItems(items);
  }

  function inc(id: number) {
    const item = items.find((i) => i.id === id)!;
    item.qty++;
    setItems([...items]);
  }

  function move() {
    user.address.city = "Delhi";
    setUser({ ...user });
  }

  function sort() {
    setItems(items.sort((a, b) => b.qty - a.qty));
  }

  return /* … */;
}
```

## Interview Answer
React decides to re-render by comparing the new state with the old using `Object.is`. In `add`, `push` mutates the same array and `setItems(items)` passes the same reference, so React bails out and nothing re-renders. In `inc`, copying the array forces a render, but `item.qty++` mutated the object in place, so memoised children, effects depending on the item, and React's change detection can miss it and strict-mode or concurrent re-renders can show inconsistencies. `move` mutates a nested object; the spread makes a new top-level object, but `address` is still shared, so a `memo` child receiving `user.address` won't update and any history or undo is corrupted. `sort` mutates in place and returns the same array reference, so React sees no change. The fix in every case is immutable updates: create new arrays and objects along the path that changed.

## Explanation
### Fixes

```tsx
function add() {
  setItems((prev) => [...prev, { id: Date.now(), qty: 1 }]);
}

function inc(id: number) {
  setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
}

function move() {
  setUser((u) => ({ ...u, address: { ...u.address, city: "Delhi" } }));
}

function sort() {
  setItems((prev) => prev.toSorted((a, b) => b.qty - a.qty));      // or [...prev].sort(...)
}
```

### Why each one failed

| Handler | Mutation | Symptom |
|---|---|---|
| `add` | `push` on state array, same ref set back | no re-render at all (bail out) |
| `inc` | in-place `qty++` | works by accident for plain children; breaks memoised children/effects keyed on the item |
| `move` | nested `address` mutated | shallow copy shares `address`; `memo`/deps on `address` don't see change |
| `sort` | `sort` mutates and returns same array | `Object.is` equal, no update |

### Why immutability
1. **Change detection by reference:** `memo`, `useMemo`, `useEffect` deps and `setState` bail-out all compare references.
2. **Predictable snapshots:** handlers closed over old state keep consistent data.
3. **Concurrent rendering:** React may render the same state multiple times; mutation during or between renders causes tearing.
4. **Dev tools & features:** undo/redo, time travel and debugging need old states intact.
5. **Strict Mode:** double-invoked updaters expose mutation bugs (the `push` inside an updater would add two items).

### Tools
- `Array.prototype.toSorted/toSpliced/with/toReversed` (ES2023).
- Spread and `structuredClone` for copies; spread along the path for nested updates.
- **Immer** (`useImmer`, `produce`) lets you write mutating-looking code safely:

```tsx
import { produce } from "immer";
setUser(produce((draft) => { draft.address.city = "Delhi"; }));
```

- TypeScript: `Readonly<T>`, `readonly T[]`, and `as const` surface accidental mutation at compile time.
- Lint: `react-hooks` and the React Compiler's rules flag some mutations.

### Related bug: missing or unstable keys
A list rendered without stable keys can show wrong rows after reordering; use ids from data.

## Follow-ups
- **Why does `setItems([...items])` sometimes seem to work after mutation?** — The new array reference triggers a render; the mutation is still wrong for memoised consumers.
- **Is mutation OK for refs?** — Yes; `ref.current` is meant to be mutable, but it doesn't trigger renders.

## Common Mistakes
- Calling `setState` with the same reference.
- Using spread for nested objects and assuming it's deep.
- Sorting state arrays in place.

## Tips
- Use the phrase "new reference along the changed path" in your explanation.
