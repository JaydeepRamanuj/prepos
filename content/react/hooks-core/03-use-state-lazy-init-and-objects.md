---
title: "useState with lazy initialisation and object/array state"
level: medium
type: concept
tags: [useState, lazy-init, immutability, objects]
related: [react/use-state-functional-updates, react/use-reducer-vs-use-state, react/use-local-storage]
---

## Question
1. What's the difference between `useState(expensive())` and `useState(() => expensive())`?
2. You keep a form in `useState({ name: "", email: "" })`. Why does `form.name = value; setForm(form)` not re-render, and how do you update nested objects and arrays correctly?

## Interview Answer
The argument to `useState` is only *used* on the first render, but `useState(expensive())` still *calls* `expensive()` on every render and throws the result away. Passing a function — `useState(() => expensive())` — is lazy initialisation: React calls it once, on mount. For objects, React compares the new state with `Object.is`; mutating the existing object and passing the same reference back looks like "no change", so React bails out, and even if something else re-renders, you've broken the snapshot older renders rely on. I always create a new object: `setForm(f => ({ ...f, name: value }))`. Unlike class `setState`, the hook setter replaces state rather than merging, so I must spread the previous fields myself.

## Explanation
### Lazy initialisation
```tsx
// ❌ JSON.parse runs on every render
const [todos, setTodos] = useState(JSON.parse(localStorage.getItem("todos") ?? "[]"));

// ✅ runs once
const [todos, setTodos] = useState<Todo[]>(
  () => JSON.parse(localStorage.getItem("todos") ?? "[]"),
);
```
Pass the function itself (`useState(createTodos)`), not its result (`useState(createTodos())`). The initializer should be pure; StrictMode calls it twice in development.

Note: reading `localStorage` in an initializer breaks server rendering (no `window` on the server) and can cause hydration mismatches — see the SSR-safe `useLocalStorage` hook.

### Why mutation doesn't work
```tsx
const [form, setForm] = useState({ name: "", email: "" });

// ❌ same reference → Object.is(old, new) is true → bail out
form.name = "Jd";
setForm(form);

// ✅ new object, other fields copied
setForm((f) => ({ ...f, name: "Jd" }));
```

### Updating immutably — cheat sheet
| Goal | Code |
|---|---|
| Update a field | `setUser(u => ({ ...u, name }))` |
| Nested field | `setUser(u => ({ ...u, address: { ...u.address, city } }))` |
| Add item | `setItems(xs => [...xs, item])` |
| Remove item | `setItems(xs => xs.filter(x => x.id !== id))` |
| Replace item | `setItems(xs => xs.map(x => x.id === id ? { ...x, done: !x.done } : x))` |
| Insert at index | `setItems(xs => [...xs.slice(0, i), item, ...xs.slice(i)])` |
| Sort | `setItems(xs => xs.toSorted(compare))` (or `[...xs].sort()`) |

Methods that mutate in place — `push`, `splice`, `sort`, `reverse`, assigning `arr[i]` — must not be used on state directly. `toSorted`, `toReversed`, `with` are the non-mutating ES2023 alternatives.

### One object or many `useState`s?
- Group values that always change together (`{ x, y }` of a pointer).
- Keep unrelated values separate — simpler updates, no spreading.
- If updates become complex (many fields, interdependent rules), switch to `useReducer`.
- Deeply nested state is a hint to flatten/normalise it (store ids, look up by id).

## Follow-ups
- **Does a shallow copy suffice for nested data?** — Only for the level you change; you must copy every object on the path from the root to the change. Immer can do this for you with mutable-looking syntax.
- **Why does mutation sometimes "work"?** — If something else triggers a render, the mutated object is read and shown, which hides the bug until it bites.

## Common Mistakes
- `useState(fn())` instead of `useState(fn)` for expensive initial values.
- Forgetting the spread and losing other fields (hooks don't merge).
- Using `sort()` on the state array.

## Tips
- Say "React compares by reference, so state updates must create new references along the changed path" — it's the rule behind every immutability question.
