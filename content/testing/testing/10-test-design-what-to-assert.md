---
title: "Write a good test: behaviour over implementation, AAA, test data and coverage"
level: medium
type: concept
tags: [test-design, behaviour-testing, aaa, coverage, test-data, mutation-testing]
related: [testing/test-pyramid-trophy, testing/testing-library-queries, testing/flaky-tests-debugging]
---

## Question
What makes a good automated test? Review this test, explain what's wrong, rewrite it, and discuss test naming, data builders, coverage metrics and mutation testing.

```tsx
test("works", () => {
  const { container } = render(<Cart items={items} />);
  const wrapper = shallow(<Cart items={items} />);
  expect(wrapper.state("total")).toBe(30);
  expect(container.querySelector(".total-label")!.innerHTML).toBe("30");
  expect(container).toMatchSnapshot();
});
```

## Interview Answer
A good test describes one behaviour, fails for exactly one reason, reads like documentation, and survives refactoring. The example is poor: the name says nothing, it mixes two render styles, asserts on internal state (`wrapper.state("total")`) and CSS class markup, and adds a large snapshot that fails on any change and gets blindly updated. I'd rewrite it to arrange data, act as a user, and assert on visible, meaningful output: render with known items, query by role or label, and expect the displayed total (and perhaps its accessible name). I name tests by behaviour ("shows the sum of line item prices as the total"), build test data with small factory functions with sensible defaults, avoid logic in tests, keep each test independent, and choose coverage as a signal not a goal. For critical logic, mutation testing (Stryker) checks whether tests actually fail when the code is altered, which coverage alone can't tell you.

## Explanation
### Rewrite

```tsx
test("shows the sum of line item prices as the total", () => {
  // Arrange
  const items = [buildItem({ price: 10, qty: 1 }), buildItem({ price: 10, qty: 2 })];

  // Act
  render(<Cart items={items} />);

  // Assert
  expect(screen.getByRole("status", { name: /total/i })).toHaveTextContent("$30.00");
});
```

Uses accessible queries, one behaviour, no state/CSS dependence, with a factory for data.

### Principles
1. **Test behaviour, not implementation**: assert on outputs the user or caller can observe (DOM text, return values, emitted requests), not on private state, hook internals or call order of collaborators you own.
2. **Arrange–Act–Assert** (or Given–When–Then): separate setup, action and verification, with a blank line between.
3. **One reason to fail**: focused assertions; multiple `expect`s are fine if they describe one behaviour.
4. **Descriptive names**: "when X, then Y"/"should…" describing the scenario and outcome; the failure message should tell you what broke.
5. **Independent and deterministic**: no shared mutable state; control time/random; no order dependence.
6. **Readable over DRY**: some duplication in tests is fine; avoid conditionals, loops and complex helper logic that need their own tests.
7. **Use realistic data** but only the details relevant to the test (builders hide irrelevant noise).
8. **Fast**: avoid unnecessary renders, sleeps and network.
9. **Negative and edge cases**: empty list, error, boundaries, invalid input, permissions.
10. **Failing first**: when fixing a bug, write a test that reproduces it, see it fail, then fix.

### Data builders

```ts
let seq = 0;
export const buildItem = (overrides: Partial<Item> = {}): Item => ({
  id: `item-${++seq}`,
  name: "Widget",
  price: 10,
  qty: 1,
  ...overrides,
});
```

Libraries: `@faker-js/faker` (seed it for determinism), `fishery`, or hand-written factories. Prefer overriding only what matters to the test.

### Snapshots
- Good for small, stable, structured outputs (serialised config, error shapes, a few lines of generated code).
- Bad for large DOM trees: they're brittle, unreviewed and don't state intent. If used, keep them small and review diffs seriously; inline snapshots (`toMatchInlineSnapshot`) keep intent visible.

### Coverage
- Line/branch coverage reveals untested code; it doesn't prove that the tests assert anything.
- Targets (e.g. 80%) can encourage low-value tests; prefer covering risky logic thoroughly and tracking uncovered critical paths.
- Use coverage diff on PRs (new code must be tested) rather than a global number.
- **Mutation testing** (Stryker, `@stryker-mutator/vitest-runner`): mutates the code (flip operators, remove statements) and checks whether tests fail; surviving mutants indicate weak assertions. Run it on critical modules, not the whole app.

### Anti-patterns
- Testing implementation (private methods, internal state, snapshots of component instances).
- Asserting on mocks of things you own, so the test only restates the code.
- Giant tests that check everything; tests that depend on each other.
- Conditional logic in tests.
- Using `any` in tests to silence types; test files should be typed.
- Commented-out or permanently skipped tests.
- "Happy path only" coverage.

### Test names as documentation
A suite should read like a spec:

```txt
Cart
  ✓ shows the sum of line item prices as the total
  ✓ applies a percentage coupon to the subtotal
  ✓ disables checkout when the cart is empty
  ✓ shows an error when the coupon is expired
```

## Follow-ups
- **Is one assertion per test a rule?** — Not strictly; keep one behaviour per test, which may need several assertions.
- **How do you test code you inherited without tests?** — Characterization tests: pin current behaviour at a boundary, then refactor with safety.

## Common Mistakes
- Updating snapshots without reading diffs.
- Chasing coverage numbers.
- Duplicating production logic inside the test to compute expected values.

## Tips
- Show the rewritten test and explain each improvement briefly.
