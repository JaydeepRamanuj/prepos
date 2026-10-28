---
title: "End-to-end tests fail randomly in CI. How do you stabilise them?"
level: hard
type: scenario
tags: [flaky-tests, playwright, e2e, ci, async, test-data, isolation, retries]
related: [testing/unit-vs-integration-vs-e2e, testing/testing-hooks-async-ui, scenarios/app-slow-after-release]
---

## Question
About 10% of CI runs fail with different Playwright tests each time, and they usually pass on re-run. People have started ignoring red builds. How do you diagnose and fix the flakiness, and what policy do you put in place?

## Clues
- Flakiness is a signal: either the test is wrong, the app has a race, or the environment is unreliable.
- Retries hide problems; they don't fix them.
- Determinism comes from controlling data, time, network and waiting correctly.

## Interview Answer
I treat flaky tests as bugs with a root cause, not noise. First I gather data: which tests fail, how often, on which browsers or machines, and with what error, using CI history, trace/video artifacts and a flake dashboard; I quarantine the worst offenders only temporarily with a ticket and owner. Typical causes: waiting on time instead of conditions (hard-coded sleeps), asserting before the UI settles (not using auto-waiting web-first assertions), tests that share or depend on state and order (database rows, logged-in sessions, leftover data), reliance on real third-party services or network variability, unmocked time/randomness, animations and loading states, resource limits on CI causing timeouts, and actual race conditions in the app (which the test is rightly exposing). Fixes: use Playwright's locator auto-waiting and `expect` assertions with retry, wait for specific network responses or UI states, isolate data per test (unique ids, API seeding, transactions or ephemeral DB), mock or stub external services (MSW, `page.route`), freeze time (`page.clock`), disable animations, run tests in parallel safely with independent state, tune timeouts, and keep tests small and focused. I run failures with traces locally (`--repeat-each`, `--trace on`) to reproduce, keep retries to at most 1–2 in CI while tracking flake rate, and enforce a policy so red builds mean something again.

## Explanation
### Triage process
1. **Measure**: record per-test pass/fail history (Playwright's JSON reporter, CI analytics, Datadog CI, BuildPulse). Rank by flake rate and impact.
2. **Reproduce**: `npx playwright test path --repeat-each=50 --workers=4` (stress under parallelism), with `--trace on`. Try CPU throttling or lower worker resources to mimic CI.
3. **Inspect artifacts**: traces (timeline, network, DOM snapshots), screenshots, videos, console errors.
4. **Classify** the root cause (below), fix, and confirm with repeated runs.
5. **Quarantine** (tag `@flaky`, run in a non-blocking job) only with an owner and deadline; delete tests that provide little value.

### Root causes and fixes

| Cause | Smell | Fix |
|---|---|---|
| Fixed sleeps | `await page.waitForTimeout(2000)` | wait for conditions: `await expect(locator).toBeVisible()`, `page.waitForResponse(...)` |
| Non-retrying assertions | `expect(await el.textContent()).toBe(...)` | use web-first assertions: `await expect(el).toHaveText(...)` |
| Brittle selectors | CSS paths, text that changes | `getByRole`, `getByLabel`, `data-testid` |
| Shared state / order dependence | test B needs test A's data | independent tests; seed via API in `beforeEach`; unique identifiers |
| Test data collisions in parallel | same email/user used by many workers | generate unique data per test/worker (`test.info().workerIndex`) |
| External services | real payment/email/API calls | mock at network boundary or use sandbox test doubles |
| Time/randomness | dates, "today", random ids | `page.clock` / fixed seeds / injected clocks |
| Animations/transitions | click during animation, layout shifting | disable animations in test mode (`prefers-reduced-motion`, CSS override), rely on actionability checks |
| Auth/session setup | logging in through UI each time | save `storageState` once per worker/project |
| Cold start / slow CI | first request timeouts | warm up server, wait for readiness, raise timeouts judiciously, run against a production build |
| Race in the app | double submits, stale state | fix the app; the test found a real bug |
| Resource starvation | too many workers | reduce workers, shard across machines |
| Environment drift | different browser versions, locales | pin versions, containers, set locale/timezone explicitly |

### Example fixes
```ts
// ❌ flaky
await page.click("text=Save");
await page.waitForTimeout(1500);
expect(await page.textContent(".toast")).toContain("Saved");

// ✅ deterministic
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByRole("status")).toContainText("Saved");

// Wait on the real signal when the UI doesn't expose one
const saved = page.waitForResponse((r) => r.url().includes("/api/items") && r.request().method() === "PUT" && r.ok());
await page.getByRole("button", { name: "Save" }).click();
await saved;
```
```ts
// Stable data: create via API per test, unique per worker
test.beforeEach(async ({ request }, testInfo) => {
  const email = `user-${testInfo.workerIndex}-${Date.now()}@test.dev`;
  await request.post("/api/test/seed-user", { data: { email } });
});
```

### Pyramid and scope
Too many e2e tests are slow and flaky by nature. Push logic down: unit tests for pure logic, component/integration tests (Testing Library + MSW) for UI behaviour, and keep e2e for a few critical user journeys (login, checkout, core CRUD) and smoke tests.

### Policy and culture
- Red main branch is a stop-the-line event; flaky failures get a ticket within a day.
- Limit retries (`retries: 1` in CI), always upload traces on first failure, and report flake rates per week.
- Track "quarantine" count and keep it near zero.
- Make tests part of the definition of done; review them like production code.
- Allocate regular time for test health; recognise the work.

### Environment tips
Run against a production build (`next build && next start`) for stability, use the same Docker image locally and in CI, shard tests across machines, pin Playwright and browser versions, and fail fast on server health checks before running tests.

## Follow-ups
- **Are retries acceptable?** — As a safety net with strict limits and tracking; never as the fix.
- **How do you know a fix worked?** — Run the test hundreds of times under load (`--repeat-each`) and compare the pass rate before and after.

## Common Mistakes
- Adding sleeps and bigger timeouts.
- Normalising "just re-run it".
- Letting shared test accounts and databases accumulate state.

## Tips
- Give the classification table from memory and the `--repeat-each` reproduction trick.
