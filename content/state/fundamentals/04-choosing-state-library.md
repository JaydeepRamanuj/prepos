---
title: "Redux Toolkit vs Zustand vs Jotai vs Context — how do you choose for a new app?"
level: advanced
type: design
tags: [redux-toolkit, zustand, jotai, context, architecture]
related: [state/context-vs-store, state/server-vs-client-state, state/zustand-slices-pattern, state/why-tanstack-query]
---

## Question
You are starting a new Next.js product (dashboard + editor, team of 6 frontend engineers). The tech lead asks you to pick the client-state solution and justify it against Redux Toolkit, Zustand, Jotai and plain Context. What do you recommend, and what are the honest trade-offs?

## Clues
- First remove the state that should not be in any of these tools — what fraction of a typical app's "state" is actually server state?
- Compare the mental models: one centralized store with actions, a hook-based store with selectors, or many independent atoms.
- Think about team size, debugging needs, derived/interdependent state, and SSR.

## Interview Answer
I start by shrinking the problem: server data goes in TanStack Query or Server Components, filters go in the URL, and forms go in React Hook Form, so the client-state tool only handles genuinely client-owned shared state. For that remainder, my default is Zustand: tiny API, no provider for client-only stores, selectors for fine-grained re-renders, and middleware for persist and devtools. I would pick Redux Toolkit if the team already knows it or needs strict conventions, action-level traceability and time-travel debugging across a large team — RTK removed most of the old boilerplate, but it is still more ceremony. I would pick Jotai when the state is a graph of many small interdependent pieces, like an editor where each node's derived values depend on others, because atoms compose bottom-up and re-render with very fine granularity. Plain Context is enough for low-frequency values like theme and the current user. For this dashboard plus editor I would use Zustand for app-level UI state and consider Jotai inside the editor if derived state gets complex.

## Explanation
### Step 1: subtract what does not belong
```txt
"Global state" in a typical app
├── server data (lists, user, settings)  → TanStack Query / RSC   ← usually the majority
├── URL state (filters, tabs, page)      → search params
├── form drafts                          → React Hook Form
└── true client state                    → the library you are choosing
```

### Step 2: compare the models

| | Context + useReducer | Redux Toolkit | Zustand | Jotai |
|---|---|---|---|---|
| Model | value passed down a tree | single store, actions → reducers | store(s) with state + actions, selectors | atoms (bottom-up), derived atoms |
| Re-render control | none (whole value) | `useSelector` | selector hook | per-atom |
| Boilerplate | low | medium (slices, store, Provider) | very low | very low |
| Devtools | React DevTools only | excellent (Redux DevTools, time travel) | Redux DevTools via `devtools` middleware | Jotai devtools |
| Async / server data | manual | RTK Query included | manual (use TanStack Query) | async atoms, or TanStack Query |
| Structure for large teams | weak | strongest conventions | you define conventions (slices) | atoms can sprawl |
| SSR (Next.js App Router) | natural (provider) | store per request via provider | store per request via provider | `Provider` per request |
| Size | 0 | larger | ~1 KB | small |

### Honest trade-offs
- **Redux Toolkit**: `createSlice` + Immer made it pleasant, and RTK Query is a solid server-state cache. Cost: more concepts (store, slices, thunks, middleware), a Provider, and a heavier mental model for a small team. Benefit: every change is a named, serializable action — great for auditing complex flows and onboarding into a big codebase.
- **Zustand**: the store is a hook; actions are plain functions; no reducers or action types. Cost: freedom — without conventions (slices, selectors, where actions live), large stores get messy. Selectors returning new objects need `useShallow` in v5.
- **Jotai**: state is a set of atoms; derived atoms recompute only when their dependencies change. Excellent for fine-grained, interdependent state (spreadsheets, editors, canvas). Cost: logic spreads across many atoms; harder to see "the whole state" in one place.
- **Context**: zero dependencies and naturally scoped, but no selectors; any change re-renders every consumer. Fine for theme, locale, auth, feature flags.

### A recommendation, stated as a decision
```txt
Server state → TanStack Query (or RSC for read-only pages)
URL state    → search params
Forms        → React Hook Form + Zod
Client state → Zustand, split into slices per domain, devtools in dev
Theme/user   → Context
Revisit if   → editor state becomes a dependency graph (consider Jotai there)
```

Mentioning the "revisit if" condition signals that you treat this as a reversible decision with known exit criteria.

## Follow-ups
- **Why not use RTK Query instead of TanStack Query?** — Both are good; RTK Query fits if you are already on Redux. TanStack Query is framework-agnostic, has a larger ecosystem, and does not require Redux.
- **What is the difference between Zustand and Jotai from the same authors?** — Zustand is top-down (one store, select slices out); Jotai is bottom-up (compose small atoms into derived ones).
- **How would you migrate from Redux to Zustand?** — Feature by feature: move server data to TanStack Query first (that usually deletes most of Redux), then port remaining slices to Zustand stores.

## Common Mistakes
- Picking a library before separating server state — then comparing tools on a job none of them should do.
- Claiming Redux is "dead" or "too much boilerplate" without acknowledging RTK.
- Claiming Context "causes re-renders of the whole app" — it re-renders consumers, not every component.

## Tips
- Structure the answer as subtract → compare → recommend → exit criteria. It reads as a senior design answer rather than a library preference.
