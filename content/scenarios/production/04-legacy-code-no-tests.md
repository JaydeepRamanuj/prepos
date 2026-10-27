---
title: "You inherit a critical legacy module with no tests and must change it safely"
level: hard
type: scenario
tags: [legacy-code, refactoring, characterization-tests, strangler-fig, risk, incremental-migration]
related: [architecture/scaling-codebase-team, scenarios/feature-flags-rollout, nextjs/pages-to-app-router-migration]
---

## Question
Your team owns a 3,000-line `OrderForm.jsx` class component, written years ago, with no tests, tangled state and business rules mixed with UI. Product wants a new payment option added in two weeks. Do you rewrite it? How do you make the change safely?

## Clues
- Rewrites hide risk: you lose undocumented behaviour that customers rely on.
- Tests describing *current* behaviour make change safe before you improve the design.
- Deliver value while reducing risk, in small, reversible steps.

## Interview Answer
I would not start with a rewrite. I'd first understand the code's role and risk, then build a safety net with **characterization tests** that capture what it does today (including quirks), starting at the highest level that is practical: end-to-end or integration tests (Playwright/Testing Library) for the key flows, plus unit tests for pure logic as I extract it. Then I make the feature change with the smallest, most local modification, using the **Mikado/strangler** approach: carve out the area I need to touch (for example, payment method selection) into a new, well-tested module or hook, leave the old behaviour intact behind it, and ship behind a feature flag with monitoring. In parallel I improve the surroundings opportunistically (the "boy scout rule"), extracting pure business rules into functions, introducing types, and breaking the component up only where I'm already working. I negotiate scope and timeline with product by presenting the risk and a plan (safety net first, then feature), and record the tech-debt backlog so a larger, incremental modernisation can happen over time rather than as a big-bang rewrite.

## Explanation
### Why not rewrite
- Hidden requirements: edge cases, regulatory rules, bug-for-bug expectations.
- Two systems to maintain during the rewrite; features stall.
- Rewrites routinely exceed estimates and reintroduce old bugs.
- Better: change incrementally while keeping the product shippable.

### Step-by-step plan
1. **Understand**: read the code, trace data flow, interview people who know the history, check analytics and bug history for the module, identify the critical paths (what earns money or causes incidents).
2. **Create a safety net**:
   - Record typical user journeys as e2e tests (Playwright) against a seeded environment.
   - Add **characterization tests**: call the code, observe the actual output, assert it (snapshots for complex outputs are acceptable here as they pin current behaviour).
   - Mock network with MSW so tests are deterministic.
   - Add logging/metrics around the area to see real usage.
3. **Make seams**: find places to insert changes with minimal edits: props, callbacks, small wrapper components, dependency injection of the API client, extracting pure functions (`calculateTotal`) without altering behaviour.
4. **Implement the feature in new code**: a `PaymentMethodSelector` with tests, integrated through the narrowest seam; legacy paths unchanged.
5. **Release safely**: feature flag, canary users, metrics, quick rollback.
6. **Refactor opportunistically**: after tests are green, extract hooks (`useOrderTotals`), split subcomponents, replace class lifecycle with hooks, add TypeScript types gradually (`allowJs`, `// @ts-check`, convert file by file).
7. **Plan modernisation**: a strangler-fig migration, replacing screen sections one at a time, tracked in a roadmap with measurable outcomes (test coverage on the module, size, defect rate).

### Characterization test example
```tsx
it("applies the bulk discount exactly like production does", () => {
  render(<OrderForm items={[{ sku: "A", qty: 12, price: 100 }]} />);
  // We don't know *why* 12 items gets 7.5% off; we pin what it does today
  expect(screen.getByTestId("total")).toHaveTextContent("₹1,110.00");
});
```
Mark such tests with comments linking to tickets or questions for the business; later confirm or fix behaviours deliberately.

### Communicating with product
- Present options: (a) hack in the feature untested (fast, risky); (b) safety net + incremental change (slightly slower, safe); (c) rewrite (slow, risky).
- Quantify risk with incident history and revenue exposure.
- Agree on a time-boxed approach and what "done" means (tests, flag, monitoring).
- Make debt visible: tickets with impact estimates; allocate a steady percentage of capacity.

### Techniques and tools
- **Approval/snapshot testing** to quickly pin complex outputs.
- **Mutation testing** to judge whether the tests would catch changes.
- **Code search + coverage tooling** to see what actually runs.
- **Adapter/anti-corruption layers** so new code doesn't inherit legacy shapes.
- **Feature flags and dark launches** to compare old/new outputs in production (shadow mode: run both, log differences, serve the old).

## Follow-ups
- **When *is* a rewrite justified?** — When the platform is unsupported or unfixable, the module is small and well understood, or business needs fundamentally differ; even then, prefer incremental replacement.
- **What if you can't get tests running at all?** — Start with manual regression scripts and e2e recordings, then add logging to see behaviour in production, and create seams to enable lower-level tests.

## Common Mistakes
- Refactoring before having tests.
- Mixing feature work and large refactors in one PR.
- Silently "fixing" odd behaviour that users depend on.

## Tips
- Say "characterize, carve a seam, ship behind a flag, then improve".
