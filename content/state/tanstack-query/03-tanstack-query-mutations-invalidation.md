---
title: "Mutations and cache updates in TanStack Query: invalidate, setQueryData, and when to use which"
level: medium
type: concept
tags: [tanstack-query, useMutation, invalidateQueries, setQueryData, cache-updates]
related: [state/tanstack-query-basics, state/tanstack-query-optimistic-updates, nextjs/revalidate-after-mutation]
---

## Question
How do you update server data with TanStack Query and keep the UI consistent? Compare invalidating queries after a mutation with writing the response into the cache using `setQueryData`, and explain the mutation lifecycle callbacks.

## Interview Answer
`useMutation` runs an async write (`mutationFn`) and exposes `mutate`/`mutateAsync`, `isPending`, `error` and callbacks (`onMutate`, `onSuccess`, `onError`, `onSettled`). After a mutation succeeds, cached queries are potentially stale, so I either invalidate the affected keys with `queryClient.invalidateQueries({ queryKey })`, which marks them stale and refetches the active ones, or, when the server returns the updated entity, write it directly into the cache with `setQueryData`, saving a round trip. Invalidation is simple and always consistent with the server but costs a network request and can briefly show old data; direct cache updates are instant but I must replicate how the server shapes lists and sorts. Often I combine them: `setQueryData` for the detail entry and `invalidateQueries` for lists. For instant feedback before the server responds I use optimistic updates (covered separately). Awaiting the invalidation promise in `onSuccess` keeps the mutation `isPending` until fresh data arrives.

## Explanation
### Basic mutation with invalidation

```tsx
const queryClient = useQueryClient();

const addTodo = useMutation({
  mutationFn: (title: string) =>
    fetch("/api/todos", { method: "POST", body: JSON.stringify({ title }), headers: { "Content-Type": "application/json" } })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() as Promise<Todo>; }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),   // return the promise to keep isPending until refetched
});

<form onSubmit={(e) => { e.preventDefault(); addTodo.mutate(title); }}>
  <button disabled={addTodo.isPending}>{addTodo.isPending ? "Adding…" : "Add"}</button>
  {addTodo.isError && <p role="alert">{addTodo.error.message}</p>}
</form>
```

### Writing the response into the cache

```tsx
const updateTodo = useMutation({
  mutationFn: (t: Todo) => api.put(`/todos/${t.id}`, t),
  onSuccess: (updated) => {
    queryClient.setQueryData(todoKeys.detail(updated.id), updated);                       // instant, no refetch
    queryClient.setQueryData<Todo[]>(todoKeys.list(filters), (old) =>
      old?.map((t) => (t.id === updated.id ? updated : t)));                              // keep the list in sync
    queryClient.invalidateQueries({ queryKey: todoKeys.lists(), refetchType: "none" });    // mark other lists stale, refetch lazily
  },
});
```

`setQueryData` expects immutable updates (return new objects); returning `undefined` from the updater cancels the update.

### Which to use

| Approach | Pros | Cons | Use when |
|---|---|---|---|
| `invalidateQueries` | simple, always correct, handles sorting/filters/pagination | extra request, brief stale UI | default; lists and complex queries |
| `setQueryData` | instant, saves request | must replicate server logic; can drift | server returns full updated entity; detail pages |
| Optimistic update | instant UI before response | rollback logic | high-latency actions (likes, toggles) |
| `refetchType: "none"` invalidate | mark stale without immediate fetch | not up-to-date until used | many inactive queries |
| `queryClient.resetQueries` / `removeQueries` | clear caches | loses data | logout, big changes |

### Invalidation matching

```ts
queryClient.invalidateQueries({ queryKey: ["todos"] });                       // all todos queries (prefix match)
queryClient.invalidateQueries({ queryKey: ["todos", "list"], exact: false });
queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "todos" && q.state.data?.length === 0 });
```

Active queries (with mounted observers) refetch immediately; inactive ones are marked stale and refetch when used.

### Lifecycle

```ts
useMutation({
  mutationFn,
  onMutate: async (vars) => { /* before the request; return context for rollback */ },
  onError: (err, vars, context) => { /* rollback */ },
  onSuccess: (data, vars, context) => { /* update cache */ },
  onSettled: (data, err, vars, context) => { /* always: invalidate to re-sync */ },
});
```

Mutation-level callbacks vs `mutate(vars, { onSuccess })` callbacks: the latter don't fire if the component unmounts before completion; use hook-level callbacks for cache work.

### Patterns
- **Colocate mutation hooks** (`useCreateTodo`) with query keys for consistency.
- **Global handlers**: `new QueryClient({ mutationCache: new MutationCache({ onError: toastError }) })`.
- **Dependent updates**: `mutateAsync` with try/catch for sequential flows.
- **Pending UI**: `useMutationState` to read pending mutations anywhere (e.g. show pending items in a list).
- **Paused mutations offline** resume when back online (`networkMode`).

### Server frameworks
In Next.js with Server Actions, the mutation can be a Server Action called from `mutationFn`, but then you must invalidate both the server cache (`updateTag`/`revalidateTag`) inside the action and the client cache with `invalidateQueries`.

## Follow-ups
- **Should the mutation's `onSuccess` return the invalidate promise?** — Yes if you want `isPending` to remain true until the refetch finishes.
- **`mutate` vs `mutateAsync`?** — `mutateAsync` returns a promise (must catch errors); `mutate` handles errors via callbacks/state.

## Common Mistakes
- Forgetting to invalidate lists after create/delete.
- Mutating cached objects in `setQueryData`.
- Relying on component-level `mutate` callbacks for cache updates.

## Tips
- Say "invalidate by default, setQueryData when the response is authoritative".
