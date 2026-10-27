---
title: "Where should a piece of state live? Explain colocation and lifting state."
level: medium
type: concept
tags: [state, colocation, lifting-state, architecture]
related: [state/server-vs-client-state, state/context-vs-store, react/why-component-rerenders]
---

## Question
You are building a product listing page with a search box, a filter sidebar, a product grid and a "compare" tray that appears at the bottom. How do you decide where each piece of state lives? What is colocation, and when do you lift state up or move it to a global store?

## Interview Answer
My default is colocation: state lives as close as possible to the components that use it, and I only move it up when a second component genuinely needs it. If two siblings need it, I lift it to their nearest common parent; if it is needed far apart in the tree or across routes, I reach for Context or a small Zustand store. Before any of that I check two things: is it server data, in which case it goes in TanStack Query, and should it survive a refresh or be shareable, in which case it goes in the URL. On the listing page, the search text and filters go in the URL, the products come from a query keyed by those params, the "filter panel open" flag stays local, and the compare tray — used by every product card and the tray itself — fits a small Zustand store.

## Explanation
### The decision ladder
Walk down this list and stop at the first rule that matches:

```txt
1. Can it be computed from other state/props?   → derive it, don't store it
2. Does the server own it?                       → TanStack Query / Server Component
3. Should it survive refresh / be shareable?     → URL search params
4. Is it a form draft?                           → React Hook Form
5. Used by one component?                        → useState in that component
6. Used by a few nearby components?              → lift to nearest common parent
7. Used far apart / across routes, changes often → Zustand (or Jotai)
8. Used far apart, rarely changes (theme, user)  → Context
```

### Why colocation wins
- **Performance**: a state update re-renders the component that owns the state and its subtree. State at the top of the tree re-renders everything below it; state in a leaf re-renders only the leaf.
- **Readability**: you can understand a component without hunting for where its state is defined.
- **Deletion**: when you delete the component, its state goes with it. Global state tends to outlive the feature that needed it.

### Applying it to the listing page

| State | Where | Why |
|---|---|---|
| search text, filters, sort, page | URL `?q=&brand=&page=` | shareable, survives refresh, back button works |
| product results | `useQuery(['products', filters])` | server-owned, cache per filter combo |
| "filter sidebar open" (mobile) | `useState` in the layout component | purely visual, one owner |
| search input while typing | local `useState`, debounced into the URL | avoid a navigation per keystroke |
| compare tray items | Zustand store | product cards and the tray are far apart |

### Lifting state, concretely
Two siblings need the same value → move the state to their parent and pass value + setter down.

```tsx
function Checkout() {
  const [coupon, setCoupon] = useState("");
  return (
    <>
      <CouponInput value={coupon} onChange={setCoupon} />
      <OrderSummary coupon={coupon} />
    </>
  );
}
```

If lifting forces you to pass props through three layers that do not use them (prop drilling), first try **composition** — pass components as `children` so the intermediate layers do not need the prop — before introducing Context or a store.

### Moving state back down
Colocation also works in reverse: if global state is only read by one screen, push it back down. Reviews of mature codebases often find stores full of state used in exactly one place.

## Follow-ups
- **What is prop drilling, and is it always bad?** — Passing props through components that do not use them. Two levels is fine and explicit; beyond that, try composition, then Context or a store.
- **Why debounce the search input into the URL instead of writing every keystroke?** — Each URL update can trigger navigation and a refetch; local state keeps typing instant and the URL updates once the user pauses.

## Common Mistakes
- Starting with a global store "because the app will grow".
- Lifting state to the root layout, so every keystroke re-renders the whole page.
- Keeping a copy of a prop in state (`useState(props.value)`) and then fighting to keep them in sync.

## Tips
- Say "colocate first, lift when shared, globalize when far apart" — then show the URL and server-state exceptions. That ordering shows judgement, not library knowledge.
