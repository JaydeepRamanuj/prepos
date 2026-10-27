---
title: "What are micro-frontends, and when should you NOT use them?"
level: advanced
type: design
tags: [micro-frontends, module-federation, multi-zones, architecture, trade-offs]
related: [architecture/monorepo-when-worth-it, architecture/scaling-codebase-team, architecture/choose-rendering-architecture]
---

## Question
A VP read a blog post and wants to split your Next.js e-commerce frontend (built by 12 developers in two teams) into micro-frontends using Module Federation. Explain what micro-frontends are, the main ways to implement them, and give your honest recommendation.

## Clues
- Micro-frontends solve an *organizational* problem. What is it?
- List the integration options from coarse to fine: separate apps per URL path vs components loaded at runtime.
- What do users pay for: shared dependencies, consistent UX, bundle size?

## Interview Answer
Micro-frontends split one frontend into pieces that different teams build and deploy independently, then compose them in the browser or at the edge. They solve an organizational problem: many teams blocked by a single release train and a single codebase. There are two main forms. Route-level splitting, like Next.js Multi-Zones, gives each team its own app that owns a set of URL paths. Runtime composition, like Module Federation, loads remote components into a host app at runtime. Route-level splitting is far simpler, and runtime composition brings version-skew bugs, duplicated React copies, shared-state and styling headaches, and harder testing. For 12 developers in two teams I would not do it. I would use a monorepo with clear feature ownership, CODEOWNERS and fast CI. If one area really needs an independent release, I would split it out by route with Multi-Zones before considering Module Federation.

## Explanation
### What problem they solve
Large companies with many teams on one product run into problems such as: "My checkout fix waits for the search team's broken build", "We can't upgrade React because 40 people must agree", "A deploy takes 2 hours." Micro-frontends give each team **independent deployability** and **autonomy over its tech choices**.

### Implementation options

```txt
Coarse ───────────────────────────────────────────────────────────── Fine
Separate apps     Route-level split        Build-time packages     Runtime composition
(links between)   (Multi-Zones, reverse     (npm/monorepo libs —     (Module Federation,
                   proxy by path)            not independent deploy)  iframes, web components)
```

| Approach | Independence | Complexity | UX cost |
|---|---|---|---|
| **Multi-Zones / path routing** (`/shop/*` → app A, `/account/*` → app B) | High per area | Low–medium | Hard navigation (full page load) between zones; duplicated framework JS per zone |
| **Module Federation** (host loads `remoteEntry.js` from other deploys) | High per component | High | Version skew, shared singletons (React, router, state), bundle duplication if misconfigured |
| **iframes** | Total isolation | Low | Poor: no shared layout, a11y and resizing pain |
| **Monorepo packages** | Low (deploy together) | Medium | None |

### The hidden costs
- **Consistency.** Each team ships its own Button version, and the UX drifts. You need a shared design system anyway.
- **Performance.** Two copies of React or of a date library, plus extra network round trips for remotes.
- **Shared concerns.** Auth, analytics, feature flags and global state now cross deploy boundaries and need contracts.
- **Testing.** Integration bugs show up only when composed in production, so you need contract tests and E2E against real composition.
- **Framework fit.** Runtime module federation works most naturally with client-rendered bundles. Server Components and the App Router render on the server and stream an RSC payload, which makes runtime-federated components awkward. For Next.js, the documented, supported micro-frontend approach is **Multi-Zones**.

### When NOT to use micro-frontends
- One or two teams, or fewer than roughly 20–30 frontend developers.
- The pain is slow CI or messy code. That is fixed with build caching and boundaries, not with a distributed system.
- A highly integrated UI where every screen touches every domain.
- No platform team to own the shell, shared dependencies and tooling.

### When they make sense
Many autonomous teams, clearly separable product areas (for example `/careers`, `/help` and `/store` each owned by a different org), a need for independent release cadences, or a gradual migration in which a legacy app and a new app coexist under one domain. That last case is the strongest one.

### Recommendation for the scenario

```txt
Now:     monorepo (apps/web + packages/ui), feature folders per team,
         CODEOWNERS, Turborepo caching, preview deploys
Later:   if one area needs its own release train → Multi-Zones by path
Last:    Module Federation only for true runtime plug-ins (e.g. third-party widgets)
```

## Follow-ups
- **How does a Multi-Zone app avoid asset conflicts?** — Each zone sets an `assetPrefix` so its static files do not collide, and the main app (or a proxy) rewrites paths to the right zone. Links across zones are hard navigations.
- **How would you share state between micro-frontends?** — As little as possible. Use the URL, a small event bus or custom events, or the backend as the source of truth. A shared global store recreates the coupling you split to escape.

## Common Mistakes
- Using micro-frontends to fix code quality. A distributed monolith is worse than a monolith.
- Ignoring the design system, so the product looks like several different apps stitched together.

## Tips
- Use the phrase "**micro-frontends are an org-chart solution**" (Conway's law). Then show you would reach for the cheapest option that solves the actual pain.
