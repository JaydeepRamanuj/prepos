---
title: "Test a custom hook and async UI states: renderHook, act and loading/error/empty"
level: medium
type: implement
tags: [renderHook, act, custom-hooks, async-testing, loading-states, tanstack-query]
related: [react/use-debounce, testing/testing-library-queries, testing/mocking-msw-vi-mock]
---

## Question
Write tests for (1) a `useCounter` hook, (2) a `useDebounce` hook with fake timers, and (3) a `UserList` component that loads users and shows loading, error, empty and success states. Explain when to test a hook directly versus through a component.

## Interview Answer
I test a hook directly with `renderHook` when it contains reusable logic with no meaningful UI of its own, wrapping state updates in `act` (or using `await` helpers) so React flushes updates, and returning `result.current` to assert values. For timers I use fake timers and advance them inside `act`. For components with async data I assert each state from the user's perspective: render, assert the loading indicator, then `await screen.findBy…` for the final output, and use MSW handlers to produce error and empty responses; I query by role (`status`, `alert`, `list`) so the tests also verify accessible semantics. If a hook is only used by one component, I usually test it through that component, since the behaviour users see is what matters and it keeps tests resilient to refactors.

## Explanation
### 1. A simple hook

```ts
// useCounter.ts
export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);
  return { count, increment, reset };
}
```

```ts
import { renderHook, act } from "@testing-library/react";

test("increments and resets", () => {
  const { result } = renderHook(() => useCounter(5));

  act(() => result.current.increment());
  expect(result.current.count).toBe(6);

  act(() => result.current.reset());
  expect(result.current.count).toBe(5);
});

test("responds to prop changes with rerender", () => {
  const { result, rerender } = renderHook(({ initial }) => useCounter(initial), { initialProps: { initial: 1 } });
  rerender({ initial: 10 });
  act(() => result.current.reset());
  expect(result.current.count).toBe(10);
});
```

Import `act` from `@testing-library/react` (it wraps React's `act`); with React 19 you can also `import { act } from "react"`. `result.current` always points to the latest return value, so re-read it after updates; don't destructure once and reuse.

### 2. Hook with timers

```ts
test("useDebounce updates after the delay", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: "a" } });

  rerender({ v: "ab" });
  expect(result.current).toBe("a");                 // not yet

  act(() => { vi.advanceTimersByTime(299); });
  expect(result.current).toBe("a");

  act(() => { vi.advanceTimersByTime(1); });
  expect(result.current).toBe("ab");
  vi.useRealTimers();
});
```

Wrappers for context-dependent hooks: `renderHook(() => useAuth(), { wrapper: AuthProvider })`.

### 3. Async component states

```tsx
function UserList() {
  const { data, error, isPending } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  if (isPending) return <p role="status">Loading…</p>;
  if (error) return <p role="alert">Couldn't load users</p>;
  if (data.length === 0) return <p>No users yet</p>;
  return <ul>{data.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

```tsx
function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><UserList /></QueryClientProvider>);
}

test("shows users after loading", async () => {
  server.use(http.get("/api/users", () => HttpResponse.json([{ id: 1, name: "Asha" }, { id: 2, name: "Ravi" }])));
  renderList();

  expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  expect(await screen.findAllByRole("listitem")).toHaveLength(2);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("shows an error message", async () => {
  server.use(http.get("/api/users", () => new HttpResponse(null, { status: 500 })));
  renderList();
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
});

test("shows the empty state", async () => {
  server.use(http.get("/api/users", () => HttpResponse.json([])));
  renderList();
  expect(await screen.findByText("No users yet")).toBeInTheDocument();
});
```

### Direct hook test vs through a component

| Test the hook directly when… | Test through a component when… |
|---|---|
| it's shared across components | it's used by one component |
| logic is complex (reducers, timers, subscriptions) | behaviour is mostly UI-facing |
| you need fine control of inputs/edge cases | you want resilience to refactoring |
| it's a library-style utility | the hook just wires data to UI |

### Pitfalls
- Forgetting `act` when triggering updates manually (warnings, stale `result.current`).
- Calling hooks outside `renderHook`.
- Sharing a `QueryClient` across tests (cache leaks).
- Retries enabled in tests (slow failure).
- `waitFor` with side effects; use `findBy`.
- Testing React Query internals instead of observable UI.

### Race conditions
Test out-of-order responses: use delayed MSW handlers for request A and fast for B, change the input, and assert only B's result is displayed. This validates cancellation/ignore logic.

## Follow-ups
- **`waitFor` or `findBy`?** — `findBy` = `getBy` + `waitFor`; prefer it for appearance. Use `waitFor` for non-element assertions.
- **How to test Suspense?** — Render inside `<Suspense fallback>`, assert the fallback, then `findBy` the content.

## Common Mistakes
- Destructuring `result.current` once.
- Not resetting handlers/timers between tests.

## Tips
- Show loading → success, error and empty tests; they map to states users see.
