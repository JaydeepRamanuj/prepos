---
title: "Optimistic updates in TanStack Query: two approaches with rollback"
level: hard
type: implement
tags: [tanstack-query, optimistic-updates, onMutate, rollback, cancelQueries, useMutationState]
related: [state/tanstack-query-mutations-invalidation, react/use-optimistic, nextjs/optimistic-ui-server-action]
---

## Question
Implement an optimistic "toggle todo" mutation with TanStack Query v5. Show (1) the cache-based approach with `onMutate`, rollback and `onSettled` invalidation, and (2) the simpler UI-based approach using mutation `variables`. Explain race conditions and why `cancelQueries` matters.

## Clues
- Snapshot the previous cache before changing it so you can roll back.
- An in-flight refetch could overwrite your optimistic value; cancel it first.
- Always re-sync with the server in `onSettled`.

## Interview Answer
With the cache approach, `onMutate` runs before the request: I cancel outgoing refetches for the affected key so they can't overwrite the optimistic data, read the previous value with `getQueryData`, write the optimistic value with `setQueryData`, and return the snapshot as context. If the mutation fails, `onError` restores the snapshot from the context; in `onSettled` I invalidate the query so the cache converges to server truth whether it succeeded or failed. The simpler UI approach, available in v5, renders pending mutations directly from `useMutation`'s `variables` (or `useMutationState` for lists elsewhere) while `isPending`, with no cache writes and no manual rollback, because when the mutation settles the optimistic item simply disappears and the refetched data takes its place. I choose the UI approach when the optimistic data is shown in one place and the cache approach when several components read the same query.

## Explanation
### 1. Cache-based

```tsx
function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (todo: Todo) =>
      fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !todo.done }),
      }).then((r) => { if (!r.ok) throw new Error("Failed to update"); return r.json() as Promise<Todo>; }),

    onMutate: async (todo) => {
      await queryClient.cancelQueries({ queryKey: todoKeys.lists() });           // stop in-flight refetches overwriting us
      const previous = queryClient.getQueriesData<Todo[]>({ queryKey: todoKeys.lists() });   // snapshot all lists

      queryClient.setQueriesData<Todo[]>({ queryKey: todoKeys.lists() }, (old) =>
        old?.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)));      // optimistic write

      return { previous };                                                        // context for rollback
    },

    onError: (_err, _todo, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));   // roll back
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),   // resync with the server
  });
}
```

Why `cancelQueries`: if a background refetch started before the mutation finishes, its (older) response could land after the optimistic write and flip the UI back, then flip again when the mutation completes (flicker).

### 2. UI-based (v5)

```tsx
function TodoList() {
  const { data: todos } = useQuery(todosQuery);
  const add = useMutation({
    mutationKey: ["add-todo"],
    mutationFn: (title: string) => api.post("/todos", { title }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  return (
    <ul>
      {todos?.map((t) => <li key={t.id}>{t.title}</li>)}
      {add.isPending && <li style={{ opacity: 0.5 }}>{add.variables}</li>}      {/* optimistic row from variables */}
      {add.isError && <li>{add.variables} <button onClick={() => add.mutate(add.variables)}>Retry</button></li>}
    </ul>
  );
}
```

Across components: `useMutationState({ filters: { mutationKey: ["add-todo"], status: "pending" }, select: (m) => m.state.variables })` returns all pending variables, so a separate badge or list can show them.

### Comparison

| | Cache-based | UI-based (`variables`) |
|---|---|---|
| Code | more (snapshot, rollback) | minimal |
| Where optimistic data shows | every consumer of the query | only where you render it |
| Rollback | manual | automatic (item vanishes) |
| Sorting/filtering | you must replicate | you place it manually |
| Race safety | needs `cancelQueries` | no cache mutation |
| Good for | toggles, edits visible in several places | adding items to a list shown once |

### Edge cases
- **Concurrent mutations** on the same entity: the first `onSettled` invalidation may refetch while the second is pending, flickering the UI. Use `mutationKey` and only invalidate when `queryClient.isMutating({ mutationKey }) === 1` (the last one).
- **Server-assigned ids**: temporary client ids need replacement; prefer returning the created entity and swapping it in `onSuccess`.
- **Failure UX**: show an error toast and retry affordance; rollback must not surprise users silently.
- **Pagination/infinite queries**: optimistic updates must target the correct page structure (`data.pages`).
- **Offline**: mutations pause and resume (`networkMode`), keeping the optimistic state until synced; persisted mutations need `mutationFn` registered via `setMutationDefaults`.
- **Idempotency**: send desired state (done: true), not toggles, so retries are safe.

### With Server Actions / React 19
`useOptimistic` provides the UI-level equivalent without a client cache; with TanStack Query you can still use `useMutation` calling a Server Action and the approaches above.

### Testing
Use MSW to delay the response and assert the optimistic UI appears immediately, then force an error and assert rollback and the error message.

## Follow-ups
- **Why return a context from `onMutate`?** — It's passed to `onError`/`onSettled` for rollback.
- **Is invalidating in `onSettled` mandatory?** — Strongly recommended; the optimistic guess may differ from the server's result.

## Common Mistakes
- Skipping `cancelQueries`.
- Not restoring the snapshot on error.
- Mutating cached arrays in place.

## Tips
- Mention both approaches and when each wins.
