---
title: "Why does a single Context cause the whole app to re-render, and how do you fix it?"
level: hard
type: scenario
tags: [context, re-render, use-sync-external-store, selectors, performance]
related: [react/why-component-rerenders, react/state-colocation, state/zustand-selectors]
---

## Question
Your app has one `AppContext` holding `{ user, theme, cart, notifications }` plus their setters. Adding an item to the cart makes the header, sidebar and every theme consumer re-render, and typing in a cart-quantity input lags. What is going on, and what are your options for fixing it?

## Clues
- When does React re-render a context consumer? Is there a way to subscribe to just part of the value?
- What happens to the `value` object when the provider component re-renders?
- External stores with `useSyncExternalStore` can compare a *selected* slice instead of the whole value.

## Interview Answer
Every component that calls `useContext(AppContext)` re-renders whenever the context value changes by `Object.is`, and there is no built-in way to subscribe to part of it. Because the provider builds a new `{ user, theme, cart, ... }` object on every state change, a cart update re-renders every consumer, even the ones that only read `theme`. I fix it in steps. First, I memoize the value with `useMemo` so unrelated parent renders don't change it. Then I split the context by how often each part changes and who reads it: theme, user and cart each get their own provider, and setters go in a separate context because they never change. If a large, frequently updating state still needs fine-grained reads, I move it to an external store, either a small hand-written store with `useSyncExternalStore` or Zustand, where each component subscribes through a selector and re-renders only when its slice changes.

## Explanation
### Why it happens

```tsx
function AppProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  // a new object on every render, so every consumer re-renders
  const value = { cart, setCart, theme, setTheme };
  return <AppContext value={value}>{children}</AppContext>;
}
```

(React 19 lets you render `<AppContext value>` directly. `<AppContext.Provider>` still works but will be deprecated.)

`children` was created by the provider's parent, so the children themselves do not re-render because of the provider's state change. The consumers do, and there are many of them.

### Fix 1: a stable value

```tsx
const value = useMemo(() => ({ cart, setCart, theme, setTheme }), [cart, theme]);
```
This stops re-renders caused by the provider's *parent*. A cart change still notifies the theme consumers.

### Fix 2: split by update frequency

```tsx
const CartStateContext = createContext<CartItem[]>([]);
const CartActionsContext = createContext<CartActions | null>(null);

function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  // actions never change, so consumers that only dispatch never re-render
  const actions = useMemo<CartActions>(() => ({
    add: (item) => setCart((c) => [...c, item]),
    remove: (id) => setCart((c) => c.filter((i) => i.id !== id)),
  }), []);

  return (
    <CartActionsContext value={actions}>
      <CartStateContext value={cart}>{children}</CartStateContext>
    </CartActionsContext>
  );
}
```

An "Add to cart" button that only needs `add` now never re-renders when the cart changes.

### Fix 3: an external store with selectors
Context has no selectors. An external store does: `useSyncExternalStore` lets each component read a derived snapshot, and React re-renders only if that snapshot changed.

```tsx
type State = { cart: CartItem[]; theme: "light" | "dark" };
let state: State = { cart: [], theme: "light" };
const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set(update: Partial<State>) {
    state = { ...state, ...update };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  // the selector must return a stable value (a primitive or an existing reference)
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

// re-renders only when the cart length changes
const count = useStore((s) => s.cart.length);
```

This is exactly how Zustand works internally. In a real app, use Zustand rather than maintaining your own store.

### Choosing

| Data | Tool |
|---|---|
| Rarely changes (theme, locale, auth user) | Context, split per concern |
| Changes often and is read in many places | An external store with selectors (Zustand) |
| Server data (cart from an API) | TanStack Query, where each `useQuery` call already subscribes to its own slice |
| Used by one subtree | Local state, colocated |

## Follow-ups
- **Does `React.memo` on a consumer help?** No. A context change bypasses `memo`. It only helps the consumer's non-consuming children.
- **Does the React Compiler fix this?** No. It memoizes the value object for you (Fix 1), but consumers still re-render on every real change.
- **Why must the selector's result be stable?** `useSyncExternalStore` compares snapshots with `Object.is`. A selector returning a new array every call causes an infinite re-render loop. Return primitives or existing references, or memoize derived objects.

## Common Mistakes
- Putting state and setters in one object, so components that only dispatch re-render too.
- Believing `useMemo` on the value alone solves it. It only removes the *unrelated* renders.
- Reaching for Redux by reflex. Splitting contexts solves most cases.

## Tips
- Structure your answer as **memoize → split → external store with selectors**, escalating only as needed.
- State the key fact clearly: "Context has no selectors. Every consumer re-renders on every value change."
