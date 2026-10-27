---
title: "How do you structure a large Zustand store? Explain the slices pattern with TypeScript."
level: hard
type: implement
tags: [zustand, slices, typescript, architecture]
related: [state/zustand-create-store, state/zustand-middleware-persist, state/choosing-state-library]
---

## Question
Your app's Zustand store has grown to 600 lines: auth UI state, cart, and notifications all in one file. Split it into slices so each domain lives in its own file, while still being one store that can read across slices (for example, `logout` must also clear the cart). Type it properly and show where middleware goes.

## Clues
- Each slice is a function with the same `(set, get, store)` signature as the store initializer — it just returns a part of the state.
- The slice needs to know the type of the **whole** store so it can call `get().otherSliceAction()`.
- Middleware wraps the combined initializer, once — not each slice.

## Interview Answer
A slice is a function that receives the same `set` and `get` as the store initializer and returns one domain's state and actions. I type each slice as `StateCreator<FullStore, Mutators, [], ThisSlice>`, so inside the slice `get()` returns the whole store and cross-slice actions are typed, but the slice only has to return its own fields. The bound store spreads all slices into one object: `create<FullStore>()(devtools((...a) => ({ ...createCartSlice(...a), ...createAuthSlice(...a) })))`. Middleware is applied only once, around the combined initializer — the Zustand docs warn that applying it inside slices leads to unexpected behaviour. Separate stores are an alternative when domains never interact; slices make sense when they do.

## Explanation
### Types
```ts
// store/types.ts
export type CartItem = { id: string; qty: number };

export type CartSlice = {
  items: CartItem[];
  addItem: (id: string) => void;
  clearCart: () => void;
};

export type AuthSlice = {
  userName: string | null;
  login: (name: string) => void;
  logout: () => void;
};

export type AppStore = CartSlice & AuthSlice;
```

### Slices
```ts
// store/cart-slice.ts
import type { StateCreator } from "zustand";
import type { AppStore, CartSlice } from "./types";

// <FullStore, middlewares applied outside, middlewares this slice adds, what it returns>
export const createCartSlice: StateCreator<
  AppStore,
  [["zustand/devtools", never]],
  [],
  CartSlice
> = (set) => ({
  items: [],
  addItem: (id) =>
    set(
      (s) => {
        const existing = s.items.find((i) => i.id === id);
        return {
          items: existing
            ? s.items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i))
            : [...s.items, { id, qty: 1 }],
        };
      },
      undefined,
      "cart/addItem", // action name shown in Redux DevTools
    ),
  clearCart: () => set({ items: [] }, undefined, "cart/clear"),
});
```

```ts
// store/auth-slice.ts
import type { StateCreator } from "zustand";
import type { AppStore, AuthSlice } from "./types";

export const createAuthSlice: StateCreator<
  AppStore,
  [["zustand/devtools", never]],
  [],
  AuthSlice
> = (set, get) => ({
  userName: null,
  login: (name) => set({ userName: name }, undefined, "auth/login"),
  logout: () => {
    set({ userName: null }, undefined, "auth/logout");
    get().clearCart(); // cross-slice call, fully typed because get() returns AppStore
  },
});
```

### The bound store
```ts
// store/index.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createCartSlice } from "./cart-slice";
import { createAuthSlice } from "./auth-slice";
import type { AppStore } from "./types";

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createCartSlice(...a),
      ...createAuthSlice(...a),
    }),
    { name: "app-store", enabled: process.env.NODE_ENV !== "production" },
  ),
);
```

`(...a)` forwards `set`, `get` and `store` to each slice unchanged.

### Why the second generic matters
The `Mis` parameter (`[["zustand/devtools", never]]`) tells TypeScript that `set` has been enhanced by devtools, which is why `set(partial, undefined, "cart/addItem")` type-checks. If you later add `persist`, add it to every slice's list in the same order as the wrapping: `[["zustand/devtools", never], ["zustand/persist", unknown]]` for `devtools(persist(...))`.

### Rules
- **Unique keys across slices** — spreading means a duplicate key silently overwrites another slice.
- **Middleware once, outside** — not inside each slice.
- **Selectors stay the same** — components still call `useAppStore((s) => s.items)`; they do not care that slices exist.

### Slices vs multiple stores

| | One store, slices | Several stores |
|---|---|---|
| Cross-domain actions | easy via `get()` | import the other store's `getState()` |
| One devtools timeline / persist key | yes | one per store |
| Independence / code splitting | less | more |

## Follow-ups
- **How do you reset the whole store on logout?** — Keep each slice's initial state in a constant and `set` them all back, or use `useAppStore.getInitialState()` with `setState(initial, true)` — careful, replace mode also needs the actions, which `getInitialState()` includes.
- **Can a slice subscribe to another slice's changes?** — Use `subscribeWithSelector` middleware and `store.subscribe(selector, listener)` once at setup.

## Common Mistakes
- Typing a slice as `StateCreator<CartSlice>` — `get()` then cannot see other slices.
- Wrapping individual slices in `persist`/`devtools`.
- Two slices both defining `reset` or `isLoading` — the later spread wins silently.

## Tips
- Remember the four generics as "whole store, mutators in, mutators out, slice out". Writing `StateCreator<AppStore, [], [], CartSlice>` from memory is what separates you from candidates who only used a single store.
