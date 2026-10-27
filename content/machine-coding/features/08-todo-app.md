---
title: "Build a todo app with filters, persistence and optimistic updates"
level: medium
type: implement
tags: [todo, useReducer, localStorage, filters, optimistic-ui, derived-state]
related: [machine-coding/nested-comments, state/zustand-vs-redux, react/usereducer-vs-usestate]
---

## Question
Build a todo list.

**Must-haves**
- Add a todo (Enter submits; blank input rejected).
- Toggle complete, edit text (double-click) and delete.
- Filters: All, Active, Completed, plus an "N items left" counter.
- "Clear completed" button.
- Todos persist across refresh.

**Stretch goals**
- Undo the last delete.
- Sync with an API using optimistic updates and rollback.
- Drag to reorder.

## Clues
- Model changes as actions on a reducer: add, toggle, edit, delete, clear completed.
- Store the filter and the todos; compute visible todos and the active count during render.
- Reading `localStorage` in the `useState` initializer breaks SSR hydration, so hydrate in an effect or use a client-only component.

## Interview Answer
I use `useReducer` because there are several related transitions on one list, and the reducer makes each one a small pure function that is easy to reason about and test. State is `{ todos, filter }`; the visible list and the "items left" count are derived with plain expressions (or `useMemo` if the list is large), never stored. Items have stable ids from `crypto.randomUUID()`. Persistence is an effect that writes `todos` to `localStorage`, and a hydration step that reads it once after mount so server and client markup match. For an API-backed version I apply the change locally first (optimistic), send the request, and on failure dispatch a rollback action or restore the previous list, showing an error toast. Accessibility basics: a labelled input, real checkboxes for toggles, buttons for delete with descriptive labels, and `aria-live` for the counter.

## Explanation
### Reducer

```tsx
type Todo = { id: string; text: string; done: boolean };
type Filter = "all" | "active" | "completed";
type State = { todos: Todo[]; filter: Filter };

type Action =
  | { type: "hydrate"; todos: Todo[] }
  | { type: "add"; text: string }
  | { type: "toggle"; id: string }
  | { type: "edit"; id: string; text: string }
  | { type: "delete"; id: string }
  | { type: "clearCompleted" }
  | { type: "filter"; filter: Filter };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "hydrate": return { ...state, todos: a.todos };
    case "add": {
      const text = a.text.trim();
      return text ? { ...state, todos: [...state.todos, { id: crypto.randomUUID(), text, done: false }] } : state;
    }
    case "toggle": return { ...state, todos: state.todos.map((t) => (t.id === a.id ? { ...t, done: !t.done } : t)) };
    case "edit": {
      const text = a.text.trim();
      return text
        ? { ...state, todos: state.todos.map((t) => (t.id === a.id ? { ...t, text } : t)) }
        : { ...state, todos: state.todos.filter((t) => t.id !== a.id) };    // empty edit deletes
    }
    case "delete": return { ...state, todos: state.todos.filter((t) => t.id !== a.id) };
    case "clearCompleted": return { ...state, todos: state.todos.filter((t) => !t.done) };
    case "filter": return { ...state, filter: a.filter };
  }
}
```

### Component

```tsx
export function TodoApp() {
  const [state, dispatch] = useReducer(reducer, { todos: [], filter: "all" });
  const [hydrated, setHydrated] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("todos");
      if (saved) dispatch({ type: "hydrate", todos: JSON.parse(saved) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("todos", JSON.stringify(state.todos));   // don't overwrite before hydrating
  }, [state.todos, hydrated]);

  const visible = state.todos.filter((t) =>
    state.filter === "all" ? true : state.filter === "active" ? !t.done : t.done,
  );
  const left = state.todos.filter((t) => !t.done).length;

  return (
    <section>
      <form onSubmit={(e) => { e.preventDefault(); dispatch({ type: "add", text }); setText(""); }}>
        <input aria-label="New todo" value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing?" />
      </form>

      <ul>
        {visible.map((t) => <TodoItem key={t.id} todo={t} dispatch={dispatch} />)}
      </ul>

      <footer>
        <span aria-live="polite">{left} {left === 1 ? "item" : "items"} left</span>
        {(["all", "active", "completed"] as const).map((f) => (
          <button key={f} aria-pressed={state.filter === f} onClick={() => dispatch({ type: "filter", filter: f })}>{f}</button>
        ))}
        <button onClick={() => dispatch({ type: "clearCompleted" })}>Clear completed</button>
      </footer>
    </section>
  );
}

function TodoItem({ todo, dispatch }: { todo: Todo; dispatch: React.Dispatch<Action> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

  function commit() { dispatch({ type: "edit", id: todo.id, text: draft }); setEditing(false); }

  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={() => dispatch({ type: "toggle", id: todo.id })} aria-label={`Mark "${todo.text}" done`} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(todo.text); setEditing(false); } }}
        />
      ) : (
        <span onDoubleClick={() => setEditing(true)} style={{ textDecoration: todo.done ? "line-through" : undefined }}>{todo.text}</span>
      )}
      <button aria-label={`Delete "${todo.text}"`} onClick={() => dispatch({ type: "delete", id: todo.id })}>✕</button>
    </li>
  );
}
```

(In this repository's UI style you would use the `Button` and `Toggle` primitives instead of raw elements.)

### Optimistic updates with an API
```ts
async function toggleRemote(id: string) {
  dispatch({ type: "toggle", id });                // optimistic
  try { await api.patch(id); }
  catch { dispatch({ type: "toggle", id }); toast.error("Couldn't save"); }   // rollback by inverting
}
```
Inverting works for toggles; for edits keep the previous value in the action or snapshot the list. With TanStack Query use `onMutate` (snapshot and set cache), `onError` (restore), `onSettled` (invalidate).

### Interview talking points
- **Derived vs stored state:** `visible` and `left` are computed, so they can never be out of sync.
- **Hydration guard:** without `hydrated`, the persist effect writes the empty initial list over saved data.
- **Context:** pass `dispatch` through context to avoid prop drilling; it is stable between renders.
- **Memoisation:** `React.memo(TodoItem)` plus stable `dispatch` avoids re-rendering every row when one changes.
- **Undo:** keep a history stack of previous `todos` in the reducer (cap its length).

## Follow-ups
- **`useReducer` or Zustand?** — The reducer is perfect for local state; Zustand if several distant components need the list without context.
- **How would you sync across tabs?** — Listen to the `storage` event and dispatch `hydrate`.

## Common Mistakes
- Using array index as key or id.
- Storing `filteredTodos` in state.
- Writing to `localStorage` before hydration finishes.

## Tips
- Show the reducer first; the UI then falls out of it.
