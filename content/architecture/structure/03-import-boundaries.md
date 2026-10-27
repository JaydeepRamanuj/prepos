---
title: "How do you decide what is shared vs feature code, and how do you enforce import boundaries?"
level: hard
type: concept
tags: [module-boundaries, eslint, public-api, dependency-direction, architecture]
related: [architecture/feature-vs-layer-folders, architecture/barrel-files, architecture/feature-sliced-design, architecture/scaling-codebase-team]
---

## Question
In a feature-based codebase, how do you decide whether code belongs in `shared/` or inside a feature? And once you decide, how do you stop developers (and AI agents) from importing whatever they like, such as `features/cart` reaching into `features/auth/components/LoginForm`?

## Clues
- Think about the *direction* dependencies are allowed to point.
- A feature should expose a small surface, the way an npm package does.
- Conventions written in a README get ignored. What makes a rule fail CI?

## Interview Answer
Code goes in `shared/` only when it has no business meaning and at least two consumers. A Button, a fetch wrapper or a date formatter qualifies. A `CartBadge` does not. I treat each feature like a small package: it has a public entry point, and everything else is private. Dependencies point one way only: `app → features → shared`. Shared never imports from a feature, and a feature never imports another feature's internals. I enforce this with tooling rather than code review. ESLint's `no-restricted-imports`, or a boundaries plugin, fails the lint when someone deep-imports or imports in the wrong direction. That matters even more with AI agents, which take the shortest import path they can find.

## Explanation
### Deciding where code goes

```txt
Is it used by only one route/feature?
 ├─ yes → keep it in that feature (or colocate next to the route)
 └─ no  → Does it carry business/domain meaning?
          ├─ no  → shared/  (ui, lib, hooks, config)
          └─ yes → a lower "domain" module both can depend on
                   (e.g. entities/user), or compose at the page level
```

The last branch matters most. If `checkout` needs the user's address, the fix is not for `checkout` to import `features/profile/components/AddressCard`. Either move the domain piece (`User` type, `UserAvatar`) into a lower layer, or let the **page** compose both features and pass data between them.

### Dependency direction

```txt
   app/ (routes, composition)
     │
     ▼
 features/cart   features/auth      ← siblings never import each other's internals
     │               │
     └──────┬────────┘
            ▼
         shared/                     ← imports nothing from above
```

One-way dependencies keep `shared/` stable and prevent import cycles. It also means you can delete a feature without breaking unrelated code.

### Public API per feature

```ts
// src/features/cart/index.ts — the only file others may import
export { CartButton } from "./components/CartButton";
export { useCart } from "./hooks/use-cart";
export type { CartItem } from "./types";
// internals like CartRow, cart-store.ts stay private
```

### Enforcing it with ESLint (flat config)

```js
// eslint.config.mjs
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          // allow "@/features/cart", block "@/features/cart/components/..."
          group: ["@/features/*/*"],
          message: "Import a feature through its public index, not its internals.",
        }],
      }],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/features/*", "@/app/*"], message: "shared/ must not depend on features or app." }],
      }],
    },
  },
];
```

For richer rules (layer A may import B but not C), teams use `eslint-plugin-boundaries`, or `dependency-cruiser` for graph checks in CI. In a monorepo the boundary comes almost for free: a package can only import what its `package.json` `exports` field exposes.

### Why this matters with AI agents
An agent asked to "show the cart count in the header" will often import whatever file contains the logic. Lint rules turn the architecture into a deterministic guardrail. The agent sees the error, then fixes the import or asks you where the code should live.

## Follow-ups
- **Isn't an `index.ts` per feature a barrel file with all the barrel problems?** — It is a small, deliberate one that exports only the public API. The problems come from huge barrels that re-export everything, especially in `shared/`. Keep feature indexes small, or use explicit `exports` in a package.
- **What about circular dependencies?** — One-way layering prevents most of them. Tools such as `madge` or `dependency-cruiser` can detect the rest in CI.

## Common Mistakes
- Moving a component into `shared/` after a single reuse even though it carries business logic. The result is a shared module that knows about carts.
- Writing boundaries down in a wiki without enforcing them, so they erode within weeks.
- Making two features import each other, which creates a cycle and couples their release cycles.

## Tips
- Say "**one-way dependencies, public API per feature, enforced by lint**". Those three phrases are the whole answer.
- Mentioning `server-only` as another kind of boundary (server code cannot be imported by client code) connects this to Next.js nicely.
