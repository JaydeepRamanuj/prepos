---
title: "A test passes locally but fails randomly in CI: how do you find and fix flakiness?"
level: hard
type: debugging
tags: [flaky-tests, ci, race-conditions, test-isolation, determinism, retries]
related: [testing/playwright-e2e-basics, testing/mocking-msw-vi-mock, testing/testing-hooks-async-ui]
---

## Question
A Playwright test and a Testing Library test fail about 5% of the time in CI but pass locally. Describe a systematic approach to find the cause, the typical sources of flakiness, and what policy you would put in place for flaky tests.

## Clues
- Flakiness is nondeterminism: time, ordering, concurrency, shared state or environment.
- Reproduce by amplifying: repeat runs, slow CPU, parallelism.
- Retries hide problems; they don't fix them.

## Interview Answer
I treat flakiness as a bug with a root cause. First, gather evidence: failure logs, traces/screenshots/videos, and a failure rate across runs. Then reproduce by amplifying likely causes: run the test repeatedly (`--repeat-each`), under CPU throttling or limited workers, in the CI container, in random order and in parallel. Typical sources are timing and async races (asserting before the UI settles, fixed sleeps, un-awaited promises), shared state between tests (database rows, cookies, `localStorage`, module singletons, leaked mocks and timers), order dependence, dependency on real time or random values, network and third-party instability, animations, viewport/scroll differences, and non-deterministic data (sort order, IDs). Fixes: replace sleeps with condition-based waiting (`findBy`, web-first assertions), isolate and reset state per test, seed deterministic data, control time with fake clocks, stub unstable external services, and make selectors robust. For policy, I quarantine a flaky test with an owner and deadline, track flake rate in CI, use retries sparingly for detection (reporting passes-on-retry as flaky), and fix or delete rather than ignore.

## Explanation
### 1. Gather evidence
- Playwright trace on first retry (`trace: "on-first-retry"`), screenshots, video, console and network logs.
- Testing Library: print the DOM on failure; check for act warnings.
- Frequency, which tests, which runners (OS/CPU), time of day, parallelism level, whether failures cluster after a particular test.

### 2. Reproduce by amplifying

```bash
npx playwright test path/to/spec.ts --repeat-each=50 --workers=4   # stress parallelism
npx playwright test path/to/spec.ts --repeat-each=20 --workers=1   # does serial execution pass?
npx vitest run --sequence.shuffle                                  # random order exposes shared state
docker run --cpus=1 ...                                            # emulate a slow CI runner
```


Compare local vs CI: slower CPUs expose races; different timezone/locale/screen size/fonts expose environment assumptions.

### 3. Classify the cause

| Category | Symptom | Fix |
|---|---|---|
| Async/timing | "element not found", assertion before update | `await findBy…`/web-first assertions; wait on network/URL; no `sleep` |
| Animations | click lands on moving element | disable animations in test (`prefers-reduced-motion`, CSS), wait for stable |
| Shared state | passes alone, fails in suite | isolate contexts; reset DB/mocks/timers; unique data per test |
| Order dependence | fails when shuffled | remove implicit coupling; each test sets up its own data |
| Time/dates | fails near midnight/month-end/DST | fake timers/`page.clock`; fixed timezone (`TZ=UTC`) |
| Randomness/IDs | snapshot diffs, sorting ties | seed or stub; sort with tiebreakers |
| Network | third-party timeouts | stub with MSW/`page.route`; contract tests for real APIs |
| Environment | font, viewport, locale differences | pin viewport/locale/timezone; run in the same container image locally |
| Resource limits | timeouts under load | reduce parallelism, increase timeouts judiciously, speed up the app/test |
| Real bug | race in the product code | fix the product (flaky tests often reveal real concurrency bugs) |

### 4. Typical fixes in code

```ts
// Bad
await page.click("#save");
await page.waitForTimeout(1000);
expect(await page.textContent(".toast")).toBe("Saved");

// Good: web-first assertion retries until visible
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByRole("status")).toHaveText("Saved");
```

```tsx
// Bad: asserts synchronously on async UI
render(<List />);
expect(screen.getByText("Asha")).toBeInTheDocument();

// Good
render(<List />);
expect(await screen.findByText("Asha")).toBeInTheDocument();
```

```ts
// Isolation: unique data and cleanup
const email = `user+${crypto.randomUUID()}@example.com`;
test.afterEach(async ({ request }) => { await request.delete(`/api/test/users/${email}`); });
```

### 5. Policy
1. **Don't normalise retries**: `retries: 2` in CI detects flakiness (Playwright marks "flaky"), but each flaky test gets a ticket.
2. **Quarantine** (`test.fixme`/separate non-blocking job) with owner and a deadline; never leave permanently skipped tests.
3. **Metrics**: flake rate per test and per suite; fail the build if the rate rises.
4. **Test design guidelines** in the repo: no sleeps, isolated data, role-based locators, deterministic time.
5. **Fast feedback**: run changed tests multiple times in PR (`--repeat-each` for new tests).
6. **Review**: flag shared fixtures and global state.
7. **Infrastructure**: stable runners, pinned browser versions, same container image locally and in CI.

### 6. When retries are acceptable
For known external instability beyond your control (a hosted preview environment cold start), use targeted retries or health checks rather than blanket retries.

## Follow-ups
- **Why do flakes appear mostly in CI?** — Slower, noisier CPUs, higher parallelism, different environments.
- **Should flaky tests be deleted?** — If the behaviour is covered elsewhere or the test is low value, yes; otherwise fix. A test nobody trusts is negative value.

## Common Mistakes
- Adding `waitForTimeout` or retries to "fix" flakes.
- Skipping tests indefinitely.
- Ignoring that a flaky E2E may reflect a real race.

## Tips
- Say "reproduce by amplification, classify, fix root cause, track the rate".
