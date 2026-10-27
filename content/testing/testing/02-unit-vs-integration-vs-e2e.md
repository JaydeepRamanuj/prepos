---
title: "Unit vs integration vs end-to-end tests: define them with examples and boundaries"
level: easy
type: concept
tags: [unit-test, integration-test, e2e, test-doubles, scope]
related: [testing/test-pyramid-trophy, testing/mocking-msw-vi-mock, testing/playwright-e2e-basics]
---

## Question
What is the difference between unit, integration and end-to-end tests? Give a concrete example of each for a "add to cart" feature and say what each would catch.

## Interview Answer
A unit test checks one small piece in isolation, usually a pure function or hook, with dependencies replaced by test doubles: for example `calculateTotal(items, coupon)` returns the right total. An integration test checks that several units work together in a realistic environment: rendering the cart page component with its children, a real state store and a mocked network, clicking "Add to cart" and asserting the badge count and the request payload. An end-to-end test drives the real application through a browser, ideally with a real backend or a controlled staging environment, covering routing, server rendering, cookies and deployment configuration: sign in, add an item, see it in the cart, check out. Units give fast feedback on logic, integration tests catch wiring bugs between components and with state or data layers, and E2E tests catch environment and system-level failures; the boundaries are about what is real and what is faked.

## Explanation
### Example: "Add to cart"

**Unit**

```ts
// cart.ts
export function addItem(cart: Cart, item: Item): Cart {
  const existing = cart.find((c) => c.id === item.id);
  return existing
    ? cart.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c))
    : [...cart, { ...item, qty: 1 }];
}

// cart.test.ts
test("adding an existing item increases quantity", () => {
  const cart = [{ id: "a", name: "A", qty: 1 }];
  expect(addItem(cart, { id: "a", name: "A" })).toEqual([{ id: "a", name: "A", qty: 2 }]);
});
```

**Integration (component level)**

```tsx
test("adds a product to the cart and updates the badge", async () => {
  server.use(http.post("/api/cart", () => HttpResponse.json({ count: 1 })));
  const user = userEvent.setup();
  render(<Shop products={[{ id: "a", name: "Laptop" }]} />);

  await user.click(screen.getByRole("button", { name: /add laptop to cart/i }));

  expect(await screen.findByRole("status")).toHaveTextContent("1 item in cart");
});
```

**End-to-end**

```ts
test("user can add a product and check out", async ({ page }) => {
  await page.goto("/products/laptop");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "Cart (1)" }).click();
  await expect(page).toHaveURL(/\/cart/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page.getByText("Order confirmed")).toBeVisible();
});
```

### Comparison

| | Unit | Integration | E2E |
|---|---|---|---|
| Scope | one function/hook/component | several modules together | whole app in a browser |
| Real parts | the unit | components, state, router; network mocked | everything (maybe staging/mocked third parties) |
| Speed | ms | tens–hundreds ms | seconds |
| Flakiness | very low | low | higher |
| Catches | logic bugs | wiring/UX bugs, state issues | environment/deploy/system bugs |
| Debugging | easy | moderate | harder (traces, videos) |
| Typical tools | Vitest/Jest | Testing Library + MSW | Playwright/Cypress |

### Test doubles vocabulary
- **Stub**: returns canned data.
- **Mock**: stub plus assertions about calls (`vi.fn`).
- **Spy**: wraps a real function to record calls.
- **Fake**: working lightweight implementation (in-memory DB).
- **Dummy**: placeholder argument.

Prefer fakes/network-level mocking (MSW) for integration tests rather than mocking modules, so you test more real code.

### Choosing the level
- Pure logic → unit.
- User-visible behaviour of a component or feature → integration.
- Critical journeys and anything touching real infrastructure (auth cookies, redirects, SSR, payments) → E2E.
- Prefer the cheapest level that would catch the bug.

## Follow-ups
- **Are component tests unit tests?** — The term is blurry; rendering a component with real children and state behaves like an integration test.
- **Where do contract tests fit?** — Between integration and E2E: verify the client/server schema agreement without a full browser.

## Common Mistakes
- Calling any test with Jest a "unit test".
- Mocking everything in an "integration" test.
- E2E-testing every permutation.

## Tips
- Use one feature and show the three tests; it demonstrates the boundaries.
