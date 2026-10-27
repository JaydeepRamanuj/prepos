---
title: "When should you use useReducer instead of useState?"
level: medium
type: concept
tags: [useReducer, useState, state-management, reducers]
related: [react/use-state-functional-updates, react/props-vs-state, react/use-context-rerenders]
---

## Question
How does `useReducer` work, and when is it a better fit than `useState`? Write a reducer for a todo list and explain how it helps testing and complex transitions.

## Interview Answer
`useReducer(reducer, initialState)` returns the current state and a `dispatch` function. Instead of setting state directly, components dispatch actions describing what happened, and a pure `reducer(state, action)` function computes the next state. I reach for it when state has several related fields, when the next state depends on the previous in non-trivial ways, or when many handlers update it differently, because all transition logic lives in one testable place. `useState` is simpler for independent values. `dispatch` has a stable identity, which is handy for passing down through context without memoisation. `useReducer` is essentially Redux's idea in a component.

## Explanation
### Example

```tsx
type Todo = { id: number; text: string; done: boolean };
type Action =
  | { type: "add"; text: string }
  | { type: "toggle"; id: number }
  | { type: "remove"; id: number };

function reducer(state: Todo[], action: Action): Todo[] {
  switch (action.type) {
    case "add":
      return [...state, { id: Date.now(), text: action.text, done: false }];
    case "toggle":
      return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

function Todos() {
  const [todos, dispatch] = useReducer(reducer, []);
  return (
    <>
      <button onClick={() => dispatch({ type: "add", text: "Learn reducers" })}>Add</button>
      {todos.map((t) => (
        <label key={t.id}>
          <input type="checkbox" checked={t.done} onChange={() => dispatch({ type: "toggle", id: t.id })} />
          {t.text}
        </label>
      ))}
    </>
  );
}
```

### When it wins

| Situation | Why reducer |
|---|---|
| Several fields change together (form with status, errors, values) | One transition keeps them consistent |
| Next state depends on previous and the action | Logic centralised |
| Many places update the same state | Handlers just dispatch intent |
| You want unit tests for state logic | Reducer is a pure function: `reducer(state, action)` |
| Passing updaters deep through context | `dispatch` is stable |

### Rules
- Reducers must be pure: no mutation, no side effects, no random/date (in StrictMode React runs reducers twice to catch impurity; the todo `Date.now()` above should really come from the action creator).
- Return the same state reference to bail out of re-rendering.
- Lazy init: `useReducer(reducer, arg, init)`.

### Impossible states
Model status as a discriminated union rather than booleans:

```ts
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: Data }
  | { status: "error"; error: Error };
```

### useState vs useReducer vs a store
Local simple values: `useState`. Complex local transitions: `useReducer`. Shared across distant components or needing selectors: Context + reducer for small apps, Zustand or similar for larger ones.

## Follow-ups
- **Does `dispatch` batch?** — Yes, like `setState`.
- **Does the reducer run during render?** — Yes, so it must be pure.

## Common Mistakes
- Mutating state in the reducer.
- Doing fetches in the reducer.
- Using reducers for a single boolean.

## Tips
- Mention testability and impossible states; those are the real benefits.
