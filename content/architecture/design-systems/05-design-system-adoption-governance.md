---
title: "Driving design system adoption: governance, contribution model and measuring success"
level: advanced
type: design
tags: [design-system, governance, adoption, contribution-model, metrics, platform-team]
related: [architecture/design-system-component-api, architecture/version-design-system, architecture/scaling-codebase-team]
---

## Question
You've been asked to start a design system for a company with five product teams that each built their own buttons, modals and form fields. How do you get adoption, decide what to build, structure ownership and contributions, and know whether it's working?

## Clues
- A design system is a product with internal customers.
- Adoption usually fails because of friction and mismatched needs, not lack of mandate.
- Measure usage and outcomes, not component count.

## Interview Answer
I'd treat it as an internal product: talk to the teams first, audit the existing UI (inventory duplicates and inconsistencies), and start with the highest-leverage foundations: tokens, typography, colour, and a few heavily used accessible primitives (button, input, select, modal, toast, form field) rather than a giant catalogue. I wrap proven accessible primitives (Radix/React Aria) and build the visual layer, publish via a versioned package with great docs and live examples, and make adoption incremental: new work uses the system, old screens migrate opportunistically with codemods, and the system supports an escape hatch (`className`, `asChild`) so teams are not blocked. Governance matters: a small core team owns quality and roadmap, with a federated contribution model where product teams can propose and build components against clear standards and get fast reviews. I measure adoption (share of UI built from system components, version spread), efficiency (time to build screens, duplicated components removed, design-dev handoff time), quality (accessibility defects, visual regressions), and satisfaction (surveys, support requests), and iterate based on feedback.

## Explanation
### Phases

| Phase | Goals | Outputs |
|---|---|---|
| 0. Discover | audit UI and code, interview designers/engineers/PMs, find pain | inventory of components, duplication map, principles |
| 1. Foundations | tokens, typography, colour, spacing, icon set, theming | token package, Figma library, docs site |
| 2. Core components | most-used 10–15 components with a11y and tests | `@acme/ui` v1, Storybook, contribution guide |
| 3. Adopt | pilot with one team, migrate a flow, gather feedback | case study, codemods, improved APIs |
| 4. Scale | patterns (forms, tables, layouts), governance, versioning | release process, metrics dashboard |
| 5. Evolve | deprecations, new brands/themes, performance | roadmap, regular majors |

### What to build first
Choose by usage × inconsistency × accessibility risk: button, link, text input, select, checkbox/radio/switch, modal/dialog, toast, tooltip/popover, form field with validation, layout primitives (stack, grid, container), typography components. Defer exotic components until requested; let demand drive additions ("rule of three": build it when three teams need it).

### Ownership and contribution model

| Model | Description | Trade-offs |
|---|---|---|
| Centralised | a core team builds everything | consistent; bottleneck, can drift from needs |
| Federated | product teams contribute components with core review | scales; needs standards and review capacity |
| Hybrid (recommended) | core owns foundations and a11y-critical primitives; teams contribute patterns/specialised components via a defined process | balance |

Contribution process: RFC for new components (problem, existing solutions, API sketch), design review, implementation guide, definition of done (states, a11y, tests, docs, tokens only), core team review SLA (e.g. 2 business days), and office hours. Maintain a public roadmap and triage board.

### Making adoption easy
- Excellent docs: copy-paste examples, API tables, do/don't, accessibility notes, migration guides.
- Developer experience: TypeScript types, Storybook, ESLint rules guiding usage (`no-restricted-imports` for legacy components), codemods, starter templates, fast support.
- Don't block: allow overrides, theming, and compositional escape hatches; accept temporary divergence with tracked tech debt.
- Showcase wins: one flow rebuilt in a day, accessibility fixes, bundle size savings.
- Design alignment: Figma components map 1:1 to code, with shared names and tokens.
- Leadership support: include adoption in team goals, but earn it through value.

### Measuring success

| Metric | How | Signal |
|---|---|---|
| Adoption | % of JSX/UI elements from system (react-scanner / custom lint), apps on the latest version | coverage |
| Consistency | number of distinct button/colour/spacing values in CSS (design-token coverage) | reduced entropy |
| Efficiency | time to ship UI features, design-to-code handoff cycles, PR size | productivity |
| Quality | a11y violations (axe in CI), visual regressions, UI bug rate | fewer defects |
| Performance | shared bundle savings, duplicated CSS removed | technical wins |
| Satisfaction | developer/designer surveys, NPS, support tickets | trust |
| Contribution | external PRs, time to merge | health |

Avoid vanity metrics (component count, Storybook page count).

### Common failure modes
1. **Build it and they will come**: no consultation, wrong abstractions.
2. **Over-engineering** before real needs; too many options.
3. **Under-staffing**: part-time maintainers; stale docs; slow reviews.
4. **Rigidity**: no escape hatches → teams fork.
5. **Breaking changes without migration support** → upgrade fatigue.
6. **Design/code drift**: Figma and code diverge.
7. **Ignoring accessibility** or performance in the base components.

### Technical decisions to make early
Styling approach (Tailwind + CVA, CSS Modules, vanilla-extract, CSS-in-JS: prefer solutions friendly to Server Components), headless foundation (Radix/React Aria), packaging (ESM, tree-shaking, `"use client"` boundaries), framework support, theming mechanism (CSS variables), monorepo setup, testing and release tooling.

## Follow-ups
- **Build, buy or fork (MUI, Chakra, shadcn/ui)?** — Buy when your needs match and branding is flexible; shadcn-style copy-in ownership suits teams wanting control; build the thin brand layer on top of primitives.
- **How do you handle a team that refuses to adopt?** — Understand the blocker; fix the gap or accept a documented exception; don't mandate prematurely.

## Common Mistakes
- Measuring success by number of components.
- Centralising everything with slow reviews.
- Not investing in docs and migration tooling.

## Tips
- Frame as a product with customers, backed by metrics.
