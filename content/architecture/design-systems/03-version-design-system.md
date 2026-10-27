---
title: "Versioning and releasing a design system used by many teams"
level: hard
type: design
tags: [design-system, semver, changesets, deprecation, codemods, monorepo, release-management]
related: [architecture/design-system-component-api, architecture/monorepo-when-worth-it, architecture/design-tokens-theming]
---

## Question
Your design system package is consumed by 25 applications. How do you version it, communicate changes, handle breaking changes, and keep consumers from being stuck on old versions? Cover semver, changelogs, tooling, canaries and migration support.

## Clues
- A design system's public API includes components, props, tokens, CSS classes, and sometimes DOM structure.
- Consumers upgrade on their own schedule.
- Automation (changesets, codemods, visual tests) reduces upgrade cost.

## Interview Answer
I follow semantic versioning with a deliberately broad definition of the public API: component names and props, token names and values' semantic meaning, exported types, CSS variables and data attributes, and documented behaviour. Visual changes that alter layout or colour in ways consumers could notice get treated as breaking or at least minor with a clear note, since automated tests can't catch everything downstream. Releases are automated from PRs with changesets (each PR declares the bump and writes the changelog entry), published from CI, with canary/prerelease builds per PR so teams can test before release. Breaking changes follow a deprecation policy: add the new API, keep the old one working with a dev-only warning, ship a codemod, announce, and remove only in the next major (batching breaking changes into scheduled majors, say twice a year). I support the previous major with security and critical fixes for a defined window, publish upgrade guides, and track adoption (which versions each app uses) to chase stragglers. Visual regression and interaction tests in Storybook guard the contract.

## Explanation
### What counts as the public API

| Surface | Breaking if… |
|---|---|
| Components and props | renamed/removed, type narrowed, default changed |
| Behaviour | keyboard/focus/ARIA changes, controlled/uncontrolled semantics |
| Tokens | token removed/renamed; semantic meaning altered |
| CSS | public class names/variables/data attributes changed |
| Types | exported types narrowed |
| DOM structure | consumers target it in tests or CSS (discourage, but account for it) |
| Peer dependencies | minimum React/TypeScript/Node bumps |
| Bundle format | ESM/CJS exports, `exports` map, side-effects flags |

Changing a default colour is "technically" a patch but may break visual regression suites downstream; treat it per a documented policy (e.g. visual changes go in minors with release notes; large rebrands in majors).

### Tooling

```txt
packages/
  tokens/        @acme/tokens
  ui/            @acme/ui (components)
  icons/         @acme/icons
  codemods/      @acme/codemods
.changeset/      one markdown file per PR: bump type + summary
```

- **Changesets** (or semantic-release / release-please): contributors add a changeset; CI opens a "Version Packages" PR; merging publishes to npm and updates changelogs. Independent versions per package or fixed/linked versions for the set.
- **Conventional commits** → automated changelog (alternative).
- **Canary builds**: publish `0.0.0-pr-123` or `next` tags per PR; consumers install to try changes; Storybook/Chromatic deploys per PR.
- **Provenance**: npm provenance and signed releases.
- **Peer deps** for React, avoid bundling duplicates; `exports` map with tree-shakeable ESM.

### Deprecation workflow

1. Introduce the replacement (`<Button variant="danger">`).
2. Mark old API deprecated: JSDoc `@deprecated`, TypeScript hints, dev-only `console.warn` once per usage with a link to the guide.
3. Provide a codemod (`npx @acme/codemods button-danger-prop`) using jscodeshift or ts-morph.
4. Announce in release notes and the channel; set a removal version/date.
5. Remove in the next major.

```tsx
/** @deprecated Use variant="danger" instead. Will be removed in v5. */
isDanger?: boolean;
```

### Communicating
- Changelog by package with upgrade notes and migration examples.
- A "What's new" page, docs site versioning (docs for v3 and v4).
- Slack/mailing list and office hours around majors.
- Compatibility matrix (design system version ↔ React/Next.js versions).

### Reducing upgrade friction
- Codemods for mechanical changes.
- Backwards-compat shims during transitions (aliasing renamed props/tokens).
- Visual regression diffs against consumer apps (a "consumer CI" that builds sample apps on every PR).
- Type-level breaking changes caught by consumer type checks in canary tests.
- Feature flags/opt-in entry points for major redesigns (`@acme/ui/v5`) for incremental adoption.
- Dependabot/Renovate for consumers; track adoption via a script or dashboard to find laggards.

### Support policy
Define LTS-like windows: latest major gets features; previous major gets security and critical fixes for 6–12 months. Communicate the policy so teams can plan.

### Monorepo considerations
In a monorepo, apps can consume `workspace:*` versions and always test against the latest; external consumers use published versions. Run affected-app builds in CI (Turborepo/Nx) to catch breakage before release.

### Pitfalls
- Shipping breaking visual changes in patches.
- No way for consumers to test unreleased changes.
- Removing APIs without usage data.
- Too many majors (fatigue) or too few (accumulated debt): batch and schedule.
- Peer dependency drift causing duplicate React copies.

## Follow-ups
- **Fixed vs independent versioning?** — Fixed (all packages share a version) is simpler for consumers; independent reduces noise but adds a compatibility matrix.
- **How do you handle a critical bug in an old major?** — Backport patch releases per the support policy.

## Common Mistakes
- Treating visual changes as non-breaking.
- No automated changelog or release process.
- Skipping codemods for large renames.

## Tips
- Say "wide definition of API, automated releases, deprecate → codemod → major".
