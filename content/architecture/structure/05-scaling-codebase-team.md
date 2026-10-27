---
title: "Your codebase is growing from 1 to 10 developers — what do you change?"
level: advanced
type: scenario
tags: [scaling, team, code-ownership, conventions, ci, architecture]
related: [architecture/import-boundaries, architecture/monorepo-when-worth-it, architecture/feature-sliced-design, testing/tests-as-ai-guardrails]
---

## Question
You built a Next.js app mostly alone. The company is hiring, and in six months there will be 10 frontend developers across three product teams. Merge conflicts, inconsistent patterns and "who owns this?" questions are already starting. What do you change in the codebase and the process, and in what order?

## Clues
- What can a single developer keep in their head that ten developers cannot?
- Separate *deterministic* guardrails (tools that fail CI) from *social* ones (docs, reviews).
- Not everything at once: what gives the biggest win for the least disruption?

## Interview Answer
With one developer, the architecture lives in that person's head. With ten, it has to live in the repo and in CI. I would start with what is cheap and automatic: strict TypeScript, ESLint and Prettier in CI, required checks on every PR, and a short ARCHITECTURE.md that records the folder conventions and the reasoning behind them. Next I would move to a feature-based structure aligned with the three teams, add CODEOWNERS so each feature has a reviewing owner, and enforce import boundaries with lint so features stay decoupled. Then I would add a test safety net, mostly integration tests on critical flows plus a few E2E smoke tests, so people can change code they did not write. A shared design system keeps the UI consistent. I would only move to a monorepo or split deployments if build times or release coupling became a real bottleneck, not as the first move.

## Explanation
### What breaks as the team grows

| Team size | What breaks | Fix |
|---|---|---|
| 1 | Nothing. You remember every decision | — |
| 2–4 | Style debates in PRs, duplicate utilities | Formatter, lint, `shared/` with a clear rule |
| 5–10 | Merge conflicts in the same folders, unclear ownership, fear of changing unfamiliar code | Feature folders per team, CODEOWNERS, boundaries, tests, ADRs |
| 10+ / multiple teams | Slow CI, release coupling, one team's bug blocks another's deploy | Monorepo packages, build caching, maybe independent deploys |

### Phase 1: automate the arguments away (week 1)
- `tsconfig` with `"strict": true`, `noUncheckedIndexedAccess`.
- Prettier plus ESLint in a pre-commit hook and in CI, so style never comes up in review.
- Branch protection: PR required, CI green, at least one review.
- A PR template with what, why, how it was tested, and screenshots.

### Phase 2: make ownership visible (weeks 2–4)

```txt
src/
├── app/
├── features/
│   ├── checkout/      # Team Payments
│   ├── catalog/       # Team Discovery
│   └── account/       # Team Growth
└── shared/            # Platform (or rotating owner)
    ├── ui/
    └── lib/
```

```txt
# .github/CODEOWNERS
/src/features/checkout/   @acme/payments
/src/features/catalog/    @acme/discovery
/src/features/account/    @acme/growth
/src/shared/ui/           @acme/design-system
```

Add lint-enforced import boundaries so a team can refactor its internals without breaking anyone else.

### Phase 3: a safety net to change code you didn't write
- Integration tests for the money paths (checkout, signup) and E2E smoke tests on preview deploys.
- Preview deployments per PR so product and design can review.
- Error monitoring with source maps, so a regression points to a commit.

### Phase 4: write decisions down
Short **ADRs** (Architecture Decision Records): "We use TanStack Query for server state because…". New joiners and AI agents both read these. An `AGENTS.md`/`CLAUDE.md` with the same conventions keeps AI-generated code consistent too.

### Phase 5: only if needed
A monorepo (`apps/web`, `packages/ui`, `packages/config`) with build caching when CI is slow or a second app appears. Independent deployments (multi-zones/micro-frontends) only when teams are genuinely blocked by each other's releases.

### What not to do
- A big-bang rewrite into a new architecture while also onboarding people.
- Inventing abstractions "for scale" before the pain exists. Each one is something seven new people must learn.

## Follow-ups
- **How do you roll out a new folder structure without freezing feature work?** — Move code feature by feature as it is touched, use path aliases so imports survive moves, and enable the boundary lint rule as a warning first and as an error once the migration is done.
- **How do you keep the design system consistent across teams?** — Give it an owner, put the components in `shared/ui` (or a package), document them in Storybook, and ban ad-hoc colors with lint or token-only Tailwind config.

## Common Mistakes
- Answering only with folder structure. Scaling is mostly process and automation: CI, ownership, tests, documented decisions.
- Jumping straight to micro-frontends, which adds infrastructure cost to an organizational problem.

## Tips
- Structure the answer as phases, ordered by **cost vs impact**. That shows judgement rather than a list of buzzwords.
- One crisp line to use: "Conventions that are not enforced by CI are suggestions."
