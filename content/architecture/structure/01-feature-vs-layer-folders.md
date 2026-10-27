---
title: "Feature-based vs layer-based folder structure — which would you choose and why?"
level: easy
type: concept
tags: [folder-structure, colocation, feature-folders, architecture]
related: [architecture/nextjs-app-router-structure, architecture/import-boundaries, architecture/feature-sliced-design]
---

## Question
How would you organize the folders of a React or Next.js app? Compare a layer-based structure (`components/`, `hooks/`, `services/`) with a feature-based one (`features/cart/`, `features/auth/`). Which do you pick, and when?

## Interview Answer
Layer-based groups files by technical type, so every component sits in `components/` and every hook in `hooks/`. Feature-based groups files by the business capability they serve, so everything about the cart, including its components, hooks, API calls and types, sits in `features/cart/`. Layer-based is fine for a small app because there is nothing to decide. It stops working as the app grows: one change touches five distant folders, and nobody can delete a feature safely because its pieces are scattered. For anything beyond a few screens I go feature-based with a small `shared/` folder for truly generic code such as the design system and utilities. The rule I follow is that code lives as close as possible to where it is used, and it moves up to `shared/` only when a second feature needs it.

## Explanation
### Layer-based (group by type)

```txt
src/
├── components/
│   ├── CartItem.tsx
│   ├── CartSummary.tsx
│   ├── LoginForm.tsx
│   └── ProductCard.tsx
├── hooks/
│   ├── useCart.ts
│   └── useAuth.ts
├── services/
│   ├── cartApi.ts
│   └── authApi.ts
├── types/
│   ├── cart.ts
│   └── user.ts
└── utils/
```

This is easy to start with and easy to explain to a new developer. The trouble shows up around 30–50 components:
- **Low cohesion.** A change to the cart means editing `components/`, `hooks/`, `services/` and `types/`.
- **Folders become junk drawers.** `components/` ends up holding 120 files with no visible owner.
- **Hidden coupling.** Any file can import any other file, so the dependency graph turns into spaghetti.
- **Deletion is scary.** You cannot remove a feature by deleting one folder.

### Feature-based (group by domain)

```txt
src/
├── app/                      # routes only (Next.js)
├── features/
│   ├── cart/
│   │   ├── components/
│   │   │   ├── CartItem.tsx
│   │   │   └── CartSummary.tsx
│   │   ├── hooks/use-cart.ts
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── index.ts          # public API of the feature
│   └── auth/
│       ├── components/LoginForm.tsx
│       ├── hooks/use-auth.ts
│       ├── api.ts
│       └── index.ts
└── shared/
    ├── ui/                   # Button, Input, Dialog (design system)
    ├── lib/                  # fetcher, cn(), formatters
    └── hooks/                # useDebounce, useMediaQuery
```

The layers still exist, but *inside* each feature. You get:
- **High cohesion.** One feature means one folder, so one PR touches one place.
- **Ownership.** "Team Checkout owns `features/cart`" can be written into CODEOWNERS.
- **Safe deletion.** Removing the feature folder removes the feature.
- **Enforceable boundaries.** Lint rules can stop `features/auth` from reaching into `features/cart` internals.

### Trade-offs at a glance

| | Layer-based | Feature-based |
|---|---|---|
| Best for | small apps, prototypes, < ~5 screens | anything that will grow or has > 1–2 devs |
| Finding "all hooks" | easy | harder (spread across features) |
| Finding "everything about X" | hard | easy |
| Risk | junk-drawer folders | over-splitting into tiny features; arguments over where shared code belongs |

### The colocation rule
Place code as close to its usage as you can, and move it up only when a second consumer needs it: from component file to feature folder, then from feature folder to `shared/`. Shared code is not free. Every change to it affects every consumer, so promote code only after it has actually been reused.

## Follow-ups
- **Where does a component used by two features go?** — If it is generic UI with no business meaning, it goes to `shared/ui`. If it carries domain meaning, such as a `ProductPrice`, it goes to a lower domain layer (an `entities/product` slice in Feature-Sliced Design) that both features may import.
- **Is `hooks/` inside a feature even needed?** — Not with only one or two hooks. Flat files are fine. Add subfolders when a folder gets hard to scan, not in advance.

## Common Mistakes
- Treating structure as a one-time choice. A small app can start layer-based and migrate once it grows; what matters is consistency.
- Putting everything in `shared/` "in case it's reused". The result is a second junk drawer.
- Making features import each other's internal files, which brings back the coupling feature folders were meant to remove.

## Tips
- Say the principle out loud: **"group by reason to change"**. Files that change together should live together.
- Drawing both trees quickly on a whiteboard, then naming one concrete pain point of layer-based ("a cart change touches four folders"), makes the answer stick.
