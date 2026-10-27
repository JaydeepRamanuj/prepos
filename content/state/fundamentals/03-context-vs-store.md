---
title: "Is React Context a state management tool? When does it cause performance problems compared to a store?"
level: medium
type: concept
tags: [context, zustand, re-renders, state]
related: [state/choosing-state-library, state/zustand-selectors-useshallow, react/why-component-rerenders]
---

## Question
A teammate put the whole app state — user, cart, theme, notifications — into one `AppContext`. Typing in the search box now feels laggy. Explain why, and when you would use Context versus a store like Zustand.

## Interview Answer
Context is a dependency-injection mechanism, not a state manager: it passes a value down the tree, and the state itself still lives in a `useState` or `useReducer` somewhere. The problem is that every component that calls `useContext(AppContext)` re-renders whenever the context value changes, and there is no way to subscribe to just one field. So when the search text in that big object changes, every consumer — the header, the cart badge, the notification bell — re-renders. A store like Zustand keeps state outside React and lets each component subscribe with a selector, so a component re-renders only when the slice it selected changes. I use Context for low-frequency, widely-read values like theme, locale, the current user, or to inject a store instance, and a store for shared state that changes often.

## Explanation
### What Context actually does
```tsx
const AppContext = createContext<AppState | null>(null);

function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState);
  // new object every render → every consumer re-renders on every change
  return <AppContext value={{ state, setState }}>{children}</AppContext>;
}
```

(React 19 lets you render `<AppContext>` directly as the provider; `<AppContext.Provider>` still works.)

When `value` changes by reference, React re-renders **every** component that reads this context, regardless of which field it uses. `React.memo` on consumers does not help, because the re-render comes from the context subscription, not from props.

### Fixes if you stay with Context
1. **Split contexts** by update frequency: `ThemeContext`, `UserContext`, `CartContext`.
2. **Separate state and dispatch** into two contexts — components that only dispatch never re-render.
3. **Memoize the value** with `useMemo` so unrelated parent re-renders do not create a new object.

These help, but you are rebuilding selectors by hand.

### What a store does differently
```ts
import { create } from "zustand";

const useCartStore = create<{ count: number; add: () => void }>()((set) => ({
  count: 0,
  add: () => set((s) => ({ count: s.count + 1 })),
}));

function CartBadge() {
  const count = useCartStore((s) => s.count); // re-renders only when count changes
  return <span>{count}</span>;
}
```

The state lives in a plain JS object outside React. Components subscribe through `useSyncExternalStore`; after each update, the store runs every subscriber's selector and React re-renders only the components whose selected value changed (`Object.is` comparison). No provider is needed for a client-only app.

### Comparison

| | Context | Zustand-like store |
|---|---|---|
| Granular subscriptions | No (whole value) | Yes (selectors) |
| Needs a provider | Yes | No (except per-request SSR stores) |
| Scoped to a subtree | Naturally | Only via a provider pattern |
| Extra dependency | None | ~1 KB |
| Best for | theme, locale, auth user, injecting instances | frequently changing shared state |

### Context is still the right tool for scoping
Context is great at *making something available to a subtree* — that is why the Zustand Next.js pattern puts a store instance in Context and subscribes with selectors. You get scoping from Context and granular updates from the store.

## Follow-ups
- **Does `useMemo` on the provider value fix the lag?** — Only for re-renders caused by the parent; when the state itself changes, the value must change and all consumers still re-render.
- **What about `use(Context)` in React 19?** — `use` reads context like `useContext` but can be called conditionally; it has the same re-render behaviour.

## Common Mistakes
- Calling Context "global state management" — it only transports a value.
- Wrapping consumers in `React.memo` and expecting it to stop context-triggered re-renders.
- Creating the provider value inline without memoizing, so every parent render re-renders all consumers.

## Tips
- The phrase interviewers want: "Context has no selectors — every consumer re-renders when the value changes." Then give the split-context fix and the store alternative.
