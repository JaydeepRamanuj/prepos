---
title: "Test pyramid vs testing trophy: what should a frontend team test and how?"
level: medium
type: concept
tags: [testing-strategy, test-pyramid, testing-trophy, unit-tests, integration-tests, e2e]
related: [testing/unit-vs-integration-vs-e2e, testing/testing-library-queries, testing/playwright-e2e-basics]
---

## Question
Explain the test pyramid and the testing trophy. Where do static analysis, unit, integration and end-to-end tests fit for a React/Next.js app, and how do you decide what not to test?

## Interview Answer
The test pyramid recommends many fast unit tests, fewer integration tests, and very few slow end-to-end tests, because lower-level tests are cheaper and less flaky. The testing trophy (Kent C. Dodds) reshapes this for frontends: a base of static analysis (TypeScript, ESLint), a modest number of unit tests for pure logic, the largest layer of integration tests that render components with their children and real user interactions, and a thin top of end-to-end tests for critical journeys, with the idea that integration tests give the best confidence per cost. For a React/Next.js app I lean on TypeScript and linting for a whole class of bugs, unit-test pure functions (formatters, reducers, validation), integration-test components and features with Testing Library and a mocked network (MSW), and use Playwright for a handful of critical flows (sign-in, checkout) plus server-rendered pages that component tests can't cover. I don't test implementation details, third-party libraries, or trivial presentational code; I test behaviour users or other developers rely on, weighted by risk.

## Explanation
### Shapes

```txt
Pyramid                    Trophy
    /\  E2E                  ___ E2E (few)
   /  \                     /   \
  /----\ Integration       |     | Integration (most)
 /      \                   \___/
/--------\ Unit            Unit (some)
                           Static (TypeScript, ESLint) base
```

### Layers and tools

| Layer | What | Tools | Speed | Confidence |
|---|---|---|---|---|
| Static | types, lint, formatting | TypeScript, ESLint, Prettier | instant | catches typos, null bugs, API misuse |
| Unit | pure functions, hooks logic, reducers | Vitest/Jest | ms | logic correctness |
| Component/integration | components + children + state + mocked network | Vitest/Jest + Testing Library + MSW (or Storybook/Playwright CT) | 10–200 ms | UI behaviour |
| E2E | real browser, real (or staging) backend | Playwright, Cypress | seconds | whole system works |
| Visual | screenshots of components/pages | Chromatic, Playwright snapshots | seconds | visual regressions |
| Contract/API | schema between client and server | Zod/OpenAPI, Pact | fast | integration boundaries |

### What to test

Prioritise by **risk × change frequency × business value**:
- Money, auth, data loss, and legal flows (checkout, permissions, privacy).
- Complex logic: calculations, parsing, state machines, validation.
- Bugs that have happened (regression tests with every fix).
- Integration seams: forms with validation and submission, data loading with error/empty/loading states, routing guards.
- Accessibility basics (roles/labels queried by Testing Library double as a11y checks; add axe in integration tests).

Don't test:
- Implementation details (state variable names, internal function calls, CSS class names).
- Framework behaviour (React renders what you tell it).
- Third-party libraries.
- Trivial wrappers and constants.
- Everything through the UI when a unit test is cheaper.

### Trade-offs of each layer
- **Unit** tests are fast and precise but can give false confidence if mocks diverge from reality.
- **Integration** tests exercise real interactions between components (context, router, forms) but need good setup (providers, MSW).
- **E2E** tests are slow, can be flaky, and are harder to debug, but catch wiring, deployment and browser-specific issues.
- Over-mocking turns integration tests into unit tests of mocks.

### Next.js specifics
- Async Server Components aren't supported by Vitest/Jest/Testing Library yet; test their logic by extracting data functions and rendering synchronous presentational components, and cover the composed page with Playwright.
- Server Actions: unit test the action function with `FormData`; E2E for the form flow.
- Route Handlers: call the handler function with a `Request` in unit/integration tests.

### A pragmatic distribution
For a mid-size app: ~60% of tests as component/integration, ~25% unit (logic, hooks, utilities), ~10% E2E (critical paths), plus type checking and lint in CI. Adjust to risk and team size.

### CI strategy
1. Static + unit + integration on every PR (fast, parallel).
2. E2E smoke on PR; full E2E nightly or on main.
3. Visual tests on UI libraries.
4. Test reports and flake tracking; quarantine flaky tests with an owner and deadline (not permanent skips).

## Follow-ups
- **Is 100% coverage a goal?** — No: coverage shows what isn't tested, not quality; chase risk coverage and mutation testing for critical modules.
- **Where does TDD fit?** — Useful for logic-heavy code; for UI, write the test from the user's perspective first when the behaviour is clear.

## Common Mistakes
- Writing mostly E2E tests and ending up with a slow, flaky suite.
- Testing implementation details so refactors break tests.
- Mocking so much that tests no longer resemble production.

## Tips
- Say "confidence per cost" and give a concrete distribution for your stack.
