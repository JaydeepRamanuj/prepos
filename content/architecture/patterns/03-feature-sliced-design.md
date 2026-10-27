---
title: "What is Feature-Sliced Design, and would you use it?"
level: hard
type: concept
tags: [feature-sliced-design, fsd, layers, slices, public-api, architecture]
related: [architecture/feature-vs-layer-folders, architecture/import-boundaries, architecture/nextjs-app-router-structure]
---

## Question
Explain Feature-Sliced Design (FSD): its layers, slices and segments, and the import rule. How does it fit with the Next.js App Router, and when would you *not* use it?

## Clues
- It is feature folders plus a strict vertical hierarchy. Which layer may import which?
- "Feature" in FSD means a user *action*, not a page or a domain object.
- Next.js already has a folder called `app/`. What is the conflict?

## Interview Answer
Feature-Sliced Design is a convention for organizing frontend code into layers ordered from most app-specific to most generic: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. Each layer is split into slices by business domain, like `entities/user` or `features/add-to-cart`, and each slice is split into segments by technical purpose: `ui`, `model`, `api`, `lib`, `config`. The key rule is that a module may import only from layers below it, never from a sibling slice on the same layer, and only through the slice's public `index.ts`. That gives you a predictable, acyclic dependency graph. In Next.js I put the FSD layers inside `src/` and keep the root `app/` folder as thin route files that re-export FSD pages. I would use FSD for a large, long-lived product with several developers. For a small app the ceremony costs more than it saves.

## Explanation
### The layers

```txt
app       → providers, global styles, app-wide setup          (top: may import everything below)
pages     → full screens composed from widgets/features
widgets   → large self-contained UI blocks (Header, ProductFeed)
features  → user interactions with business value (add-to-cart, login-by-email)
entities  → business objects (user, product, order): types, UI cards, API
shared    → no business meaning: ui kit, api client, utils, config  (bottom: imports nothing above)
```

The **import rule**: a layer may import only from layers strictly *below* it. `features/add-to-cart` can use `entities/product` and `shared/ui`, but not `features/wishlist` (a sibling) or `widgets/header` (above). Older docs also had a `processes` layer, which is now deprecated.

### A concrete tree (Next.js)

```txt
.
├── app/                        # Next.js routes ONLY (root level)
│   ├── layout.tsx
│   └── products/[id]/page.tsx  # export { ProductPage as default } from "@/pages/product"
└── src/
    ├── app/                    # FSD app layer: providers, styles
    ├── pages/
    │   └── product/
    │       ├── ui/ProductPage.tsx
    │       └── index.ts
    ├── widgets/
    │   └── product-details/ui/ProductDetails.tsx
    ├── features/
    │   └── add-to-cart/
    │       ├── ui/AddToCartButton.tsx
    │       ├── model/use-add-to-cart.ts
    │       ├── api/add-to-cart.ts
    │       └── index.ts        # public API
    ├── entities/
    │   └── product/
    │       ├── ui/ProductCard.tsx
    │       ├── model/types.ts
    │       ├── api/get-product.ts
    │       └── index.ts
    └── shared/
        ├── ui/Button.tsx
        └── api/client.ts
```

There are two folder-name clashes. Next.js's routing `app/` (and `pages/`) versus FSD's `app` and `pages` layers. The usual fix is to keep the Next.js routing folders at the project root and the FSD layers in `src/`. Next.js uses the root `app/` and treats `src/pages` as ordinary code, but check that you don't end up with both a root `app/` and a `src/app/` acting as the router. The FSD docs describe this setup.

### Why it works
- **Predictability.** Anyone can tell where `AddToCartButton` lives.
- **No cycles.** Downward-only imports make the graph a DAG.
- **Refactor safety.** Public APIs per slice, enforceable with the `steiger` linter or ESLint boundary rules.

### Costs and honest criticism
- A steep learning curve. "Is this a feature, a widget or an entity?" debates are common.
- Many small files and folders for simple things.
- Entities that need each other (order → user) require the special `@x` cross-import notation.
- Recent FSD guidance itself softened this. Its "pages first" advice is to keep code in the page or widget until real reuse appears, rather than slicing everything up front.

| Use FSD when | Skip it when |
|---|---|
| Large product, 5+ devs, multi-year lifespan | Small app, prototype, solo project |
| Team agrees to learn and lint the rules | Nobody will enforce the rules |

## Follow-ups
- **How is FSD different from plain feature folders?** — Feature folders give you horizontal grouping by domain. FSD adds a vertical hierarchy, so it says not only "group by feature" but also which kind of module may depend on which.
- **Where does a Server Action go?** — In the slice it belongs to, usually `features/<action>/api`, marked `"use server"`. Server-only data access goes in `entities/<x>/api` with `import "server-only"`.

## Common Mistakes
- Calling every domain noun a "feature". `product` is an entity; `add-to-cart` is a feature.
- Letting features import each other "just this once". This breaks the main guarantee.

## Tips
- Memorize the order with "**A**ll **P**eople **W**ant **F**ree **E**spresso **S**hots": app, pages, widgets, features, entities, shared.
- Showing you know the criticism and the "pages first" softening tells the interviewer you have thought about the trade-off rather than just learned the diagram.
