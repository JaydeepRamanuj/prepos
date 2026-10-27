---
title: "\"You might not need an effect\" — refactor these effects away"
level: hard
type: scenario
tags: [useEffect, derived-state, events, keys, anti-patterns]
related: [react/use-effect-when-it-runs, react/props-vs-state, react/reconciliation-diffing, react/use-memo-when-pointless]
---

## Question
In a code review you see this component. Which effects are unnecessary, what problems do they cause, and how would you rewrite it?

```tsx
function ProductPage({ product, userId }: { product: Product; userId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [comment, setComment] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setTotal(items.reduce((s, i) => s + i.price, 0));
  }, [items]);

  useEffect(() => {
    setComment("");
  }, [userId]);

  useEffect(() => {
    if (added) {
      post("/api/cart", { id: product.id });
      showToast(`Added ${product.name}`);
    }
  }, [added, product]);

  return /* ... */;
}
```

## Clues
- An effect is for synchronising with an *external* system. Which of these touch anything outside React?
- If a value can be computed from props/state, what's the cost of storing it and syncing it?
- Ask "why does this code run?" — because the component was displayed, or because the user did something?

## Interview Answer
None of these three effects is needed. `total` is derived data: storing it means an extra render with a stale total first, so I compute it during render, wrapping in `useMemo` only if it's genuinely expensive. Resetting `comment` when `userId` changes is better done with a `key` on the component, so React resets all its state for a new user without a frame of stale data. The cart POST and toast happen because the user clicked "Add", not because the component rendered, so they belong in the event handler; as an effect they can fire again whenever `product` changes or the component remounts. My rule: effects are for synchronising with external systems — subscriptions, network for what's on screen, non-React widgets. Everything else is either render logic or event logic.

## Explanation
### 1. Derived state → compute during render
```tsx
const total = items.reduce((s, i) => s + i.price, 0);
```
The effect version renders with the old `total`, commits, runs the effect, sets state, renders again — two renders and a flash of wrong data. If profiling shows the calculation is slow, `useMemo(() => …, [items])`; with the React Compiler, even that is usually automatic.

### 2. Reset state on identity change → `key`
```tsx
// parent
<ProductPage key={userId} product={product} userId={userId} />
```
A new key means a new component instance, so *all* state resets, including nested children. The effect version renders once with the old comment before clearing it, and you must remember to reset every field.

If only *part* of the state should reset, adjust it during render by tracking the previous value — but prefer restructuring first.

### 3. User actions → event handlers
```tsx
function handleAdd() {
  post("/api/cart", { id: product.id });
  showToast(`Added ${product.name}`);
}
```
With the effect: navigating to another product while `added` is true sends a second POST; StrictMode or a remount re-sends it; and the `added` flag exists only to trigger the effect.

### The decision rule
```txt
Does this code run because the component was *shown*?
   └─ yes → effect (fetch what's displayed, subscribe, sync a widget)
Does it run because the user *did* something?
   └─ yes → event handler
Can it be computed from props/state?
   └─ yes → compute in render (memoize only if expensive)
```

### Other common unnecessary effects
- **Notifying parents** (`useEffect(() => onChange(value), [value])`) — call `onChange` in the same handler that sets state, or lift the state up.
- **Chains of effects** that set state which triggers the next effect — compute the next state in one handler.
- **Initialising the app once** — module-level code or a top-level guard, not an effect.
- **Subscribing to external stores** — `useSyncExternalStore` instead of effect + state.

### Effects that *are* right
Connecting to a chat room for `roomId`, fetching the data the page displays (or better, a framework/data library), `IntersectionObserver`, integrating a map widget, `document.title` sync.

## Follow-ups
- **Isn't fetching in an effect also discouraged?** — It's valid synchronisation, but needs race handling; frameworks (Server Components, loaders) and libraries like TanStack Query do it better with caching and deduping.
- **How does the linter help?** — Recent `eslint-plugin-react-hooks` versions include compiler-powered rules that flag patterns like setting state synchronously in an effect.

## Common Mistakes
- Treating `useEffect` as "watch this value" (a Vue `watch` replacement).
- Storing filtered/sorted lists in state and syncing them.
- Putting POST requests triggered by clicks into effects.

## Tips
- Start with the "shown vs did" rule — it's memorable and lets you classify any effect on the spot.
