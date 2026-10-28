---
title: "Using Zustand safely in Next.js: avoid shared server state with per-request stores"
level: advanced
type: design
tags: [zustand, nextjs, ssr, createStore, context, hydration, data-leak]
related: [state/implement-mini-zustand, state/zustand-middleware-persist, state/server-vs-client-state, nextjs/server-client-composition-patterns]
---

## Question
Why is a module-level `create()` Zustand store dangerous with server rendering in Next.js? Design a per-request store using `createStore`, context and a provider, and explain how to initialise it from server data and when you don't need a global store at all.

## Clues
- Server modules are shared across requests and users.
- A store created at module scope on the server persists between requests.
- Client Components render on the server too (for the first HTML).

## Interview Answer
In an SSR environment, module-level state on the server is shared by every request handled by that process. If a Client Component reads from a global `create()` store during server rendering and some code mutates it, one user's data can leak into another's HTML or the initial state can become inconsistent with the client, causing hydration mismatches. The recommended pattern is to create the store per request with the vanilla `createStore` factory inside a provider component (using `useRef` or `useState` to create it once per render tree on the client and per request on the server), expose it through React context, and read it with `useStore(storeApi, selector)` in a custom hook. Initial data from Server Components is passed as props to the provider, which seeds the store. For state that is only used on the client after interactions and never rendered on the server, a global store is acceptable, but server data should live in Server Components or the query cache, not in Zustand.

## Explanation
### The problem

```ts
// store.ts: module-level
export const useUser = create<{ user: User | null; setUser: (u: User) => void }>((set) => ({ user: null, setUser: (user) => set({ user }) }));
```

On the server this module is evaluated once per process (not per request). If a server-side render calls `setUser(alice)`, the next request (Bob) renders with `alice` unless overwritten, a data leak. On the client, the same store is a singleton per page load, which is fine.

### Per-request store

```ts
// counter-store.ts
import { createStore } from "zustand/vanilla";

export type CounterState = { count: number };
export type CounterActions = { inc: () => void };
export type CounterStore = CounterState & CounterActions;

export const createCounterStore = (init: CounterState = { count: 0 }) =>
  createStore<CounterStore>()((set) => ({
    ...init,
    inc: () => set((s) => ({ count: s.count + 1 })),
  }));
```

```tsx
// counter-store-provider.tsx
"use client";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { createCounterStore, type CounterStore } from "./counter-store";

const CounterStoreContext = createContext<StoreApi<CounterStore> | null>(null);

export function CounterStoreProvider({ children, initialCount }: { children: ReactNode; initialCount: number }) {
  const storeRef = useRef<StoreApi<CounterStore> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createCounterStore({ count: initialCount });     // created once per provider instance
  }
  return <CounterStoreContext value={storeRef.current}>{children}</CounterStoreContext>;
}

export function useCounterStore<T>(selector: (s: CounterStore) => T): T {
  const store = useContext(CounterStoreContext);
  if (!store) throw new Error("useCounterStore must be used within CounterStoreProvider");
  return useStore(store, selector);
}
```

```tsx
// app/layout.tsx or a page (Server Component) seeds the store from server data
export default async function Page() {
  const initialCount = await getCount();                           // server data
  return (
    <CounterStoreProvider initialCount={initialCount}>
      <Counter />
    </CounterStoreProvider>
  );
}
```

During SSR each request renders its own `CounterStoreProvider` instance, so there's no sharing. On the client, the provider is created once on first render (the `useRef` guard avoids recreating the store on re-render; under React Strict Mode double render it may be created twice in dev but only one is retained).

### Hydration consistency
The server and the first client render must produce the same markup: seed both from the same props. Don't read `localStorage` during the first render (see persist `skipHydration`). Don't call `Date.now()`/random in the initializer.

### Placement of providers
Put the provider as low as practical (around the part of the tree that needs it), so navigation resets state per route when appropriate; or in the root layout when state must persist across navigations (layouts persist, so the store survives client navigation between routes in that layout). Remember: Server Components can't use hooks or context; only Client Components consume the store.

### When you don't need a global store
- **Server data** (lists, entities): fetch in Server Components or use TanStack Query; pass as props.
- **URL state** (filters, tabs, pagination): `searchParams`, shareable and SSR-friendly.
- **Form state**: React Hook Form / `useActionState`.
- **Local UI state**: `useState` colocated.
- Use Zustand for cross-cutting client-only state: UI preferences, multi-step wizard state shared across routes, cart before checkout, editor state, ephemeral selections.

### Alternatives
- Hold the store on a context created in a layout for the user session.
- Jotai/Redux Toolkit have similar per-request provider requirements for SSR.
- React Context + `useReducer` for small scopes.

### Testing
Create a fresh store per test with `createCounterStore()` and wrap renders in the provider; no global reset needed.

## Follow-ups
- **Is a global client-only store safe if it's only touched in event handlers?** — The initial state is shared, but if the server never mutates it and Client Components render it identically, it's usually fine; the risk comes from server-side mutations or user-specific initial data.
- **Why `useRef` instead of `useState(() => create…)`?** — Either works; `useState` initializer is also fine, and avoids reading refs during render concerns flagged by lint rules.

## Common Mistakes
- Initialising a module-level store with user data on the server.
- Recreating the store on every render.
- Putting server-fetched entities in Zustand instead of using the framework's data layer.

## Tips
- Start with "module state on the server is shared across requests", then show the provider pattern.
