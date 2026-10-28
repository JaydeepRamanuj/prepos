---
title: "How does useOptimistic work? Implement an optimistic like button and todo add"
level: hard
type: implement
tags: [useOptimistic, optimistic-ui, actions, transitions, react-19]
related: [react/use-action-state, react/use-transition, state/tanstack-query-optimistic-updates]
---

## Question
Implement optimistic UI for adding a todo using `useOptimistic`. The item must appear instantly, be marked "sending", roll back if the server fails, and be replaced by the real item when the request completes.

## Clues
- The optimistic value is temporary: it exists only while an Action/transition is pending.
- When the transition ends, the UI shows the real state again.
- The setter must be called inside an Action (a transition or form action).

## Interview Answer
`useOptimistic(state, updateFn)` returns `[optimisticState, addOptimistic]`. While no Action is running, `optimisticState` equals the real `state`. Calling `addOptimistic(value)` inside an Action applies `updateFn(currentState, value)` to produce a temporary state that shows immediately. When the Action finishes, React discards the optimistic layer and renders the real state, which by then should include the server's result; if the request failed, the real state never changed, so the UI rolls back automatically. I mark optimistic items with a `pending` flag to show a subtle "sending" style and use it with a form Action or `startTransition(async () => ...)`.

## Explanation
### Implementation

```tsx
"use client";
import { useOptimistic, useState, useRef, startTransition } from "react";

type Todo = { id: string; text: string; sending?: boolean };

export function Todos({ initial, addTodo }: { initial: Todo[]; addTodo: (text: string) => Promise<Todo> }) {
  const [todos, setTodos] = useState(initial);                    // real state
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (current: Todo[], text: string) => [...current, { id: `tmp-${crypto.randomUUID()}`, text, sending: true }]
  );
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;
    setError(null);
    addOptimistic(text);                                          // instant, temporary
    try {
      const saved = await addTodo(text);
      setTodos((t) => [...t, saved]);                             // real state now includes it
    } catch {
      setError("Couldn't save. Try again.");                      // real state unchanged -> rollback
    }
  }

  return (
    <>
      <form action={action}>
        <input name="text" />
        <button>Add</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {optimisticTodos.map((t) => (
          <li key={t.id} style={{ opacity: t.sending ? 0.5 : 1 }}>{t.text}</li>
        ))}
      </ul>
    </>
  );
}
```

`<form action={fn}>` already runs inside a transition, so `addOptimistic` is valid. Outside a form, wrap in `startTransition(async () => { addOptimistic(x); await save(x); })`.

### Lifecycle

```txt
t0  real = [A]               optimistic = [A]
t1  addOptimistic("B")       optimistic = [A, B(sending)]   real = [A]
t2  server succeeds          setTodos([A, B'])              (action completes)
t3  transition ends          optimistic layer dropped -> shows real [A, B']
    server fails             real still [A] -> B disappears (rollback)
```

### Like button

```tsx
const [optimisticLiked, setLiked] = useOptimistic(liked, (_cur, next: boolean) => next);

<form action={async () => { setLiked(!optimisticLiked); await toggleLike(post.id); }}>
  <button>{optimisticLiked ? "♥" : "♡"}</button>
</form>
```

### Tips and pitfalls
- Keys: temporary ids differ from server ids, so the item remounts when replaced; return a stable `clientId` if you need to avoid flicker.
- Never rely on the optimistic value for logic that must be authoritative.
- Handle rollback visibly (error message), as the item silently vanishing confuses users.
- Calling it outside an Action warns in development.
- The updater function must be pure.
- In Next.js, also `revalidatePath`/`revalidateTag` in the Server Action so the real data refreshes.
- With TanStack Query the equivalent is `onMutate` + cache update + rollback `onError`.

## Follow-ups
- **What if two optimistic updates overlap?** — They stack in order via the reducer.
- **Does it replace server state?** — No; it only overlays temporary UI.

## Common Mistakes
- Calling `addOptimistic` outside a transition.
- Not updating real state after success, so the item disappears.
- No error feedback on rollback.

## Tips
- Emphasise automatic rollback: no manual undo code.
