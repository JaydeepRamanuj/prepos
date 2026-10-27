---
title: "Create a Zustand store with state and actions. How does set work?"
level: easy
type: implement
tags: [zustand, store, actions, set, get]
related: [state/zustand-selectors-useshallow, state/zustand-slices-pattern, state/implement-mini-zustand]
---

## Question
Write a typed Zustand store for a todo list with `todos`, `addTodo(title)`, `toggleTodo(id)` and `clearCompleted()`. Then use it in two components. Explain what `set` does with the object you return, and when you need `get`.

```tsx
function TodoCount() {
  const remaining = useTodoStore(/* ? */);
  return <p>{remaining} left</p>;
}
```

## Interview Answer
`create` takes a function that receives `set` and `get` and returns the initial state plus the actions, and gives me back a hook. Actions are just functions on the state object that call `set`. `set` shallow-merges whatever I return into the current state at the top level only, so I can return `{ todos: newTodos }` without spreading the rest — but nested objects I must copy immutably myself. I pass an updater function to `set` when the new value depends on the old one, and use `get()` inside an action when I need to read current state without updating, for example to decide whether to call an API. In components I always pass a selector, like `useTodoStore((s) => s.todos.length)`, so the component re-renders only when that value changes.

## Explanation
### The store
```ts
import { create } from "zustand";

type Todo = { id: string; title: string; done: boolean };

type TodoState = {
  todos: Todo[];
  addTodo: (title: string) => void;
  toggleTodo: (id: string) => void;
  clearCompleted: () => void;
};

// create<T>()(...) — the extra () is the curried form TypeScript needs to infer middleware types
export const useTodoStore = create<TodoState>()((set, get) => ({
  todos: [],

  addTodo: (title) =>
    set((state) => ({
      todos: [...state.todos, { id: crypto.randomUUID(), title, done: false }],
    })),

  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    })),

  clearCompleted: () => {
    if (!get().todos.some((t) => t.done)) return; // read without subscribing
    set((state) => ({ todos: state.todos.filter((t) => !t.done) }));
  },
}));
```

### Using it
```tsx
function TodoCount() {
  // derived primitive → re-renders only when the number changes
  const remaining = useTodoStore((s) => s.todos.filter((t) => !t.done).length);
  return <p>{remaining} left</p>;
}

function AddTodo() {
  const addTodo = useTodoStore((s) => s.addTodo); // actions never change → never re-renders from store
  return <button onClick={() => addTodo("Write tests")}>Add</button>;
}
```

### How `set` works
- `set(partial)` → `Object.assign({}, state, partial)` — a **shallow merge at the top level**.
- `set((state) => partial)` → same, with the current state passed in. Use it whenever the update depends on previous state.
- `set(next, true)` → **replace** the whole state (you would lose the actions if you forget them; v5 types require a complete state when `replace` is `true`).
- If the result is `Object.is`-equal to the current state, listeners are not notified.

Nested state is *not* merged deeply:

```ts
// state: { user: { name: "Jd", city: "Pune" } }
set({ user: { name: "JD" } });                        // city is gone
set((s) => ({ user: { ...s.user, name: "JD" } }));   // correct
```

### `get` vs a selector
`get()` reads the latest state at call time — use it **inside actions**. In components, use the hook with a selector; `useTodoStore.getState()` inside a component does not subscribe, so the UI would not update.

### Reading outside React
The hook also exposes the vanilla API: `useTodoStore.getState()`, `useTodoStore.setState()`, `useTodoStore.subscribe(listener)`. Useful in tests, event handlers outside components, or WebSocket callbacks.

## Follow-ups
- **Why `create<T>()(...)` with two calls?** — It is a curried workaround so you can specify `T` while TypeScript still infers middleware mutator types.
- **Can you have several stores?** — Yes, and it is idiomatic to keep one store per domain rather than one giant store.

## Common Mistakes
- Calling `useTodoStore()` with no selector — the component re-renders on every store change.
- Expecting `set` to deep-merge nested objects.
- Mutating state (`state.todos.push(...)`) and returning it — the reference does not change, so nothing re-renders.

## Tips
- Memorize the shape: `create<T>()((set, get) => ({ ...state, action: () => set((s) => ({ ... })) }))`. Writing it cleanly without help is the fastest credibility signal for a Zustand question.
