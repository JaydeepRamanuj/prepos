---
title: "Mocking in frontend tests: network (MSW), modules, timers and when not to mock"
level: hard
type: concept
tags: [mocking, msw, vi-mock, jest-mock, fake-timers, test-doubles, fetch]
related: [testing/testing-library-queries, testing/unit-vs-integration-vs-e2e, testing/testing-hooks-async-ui]
---

## Question
How do you mock network requests, modules, browser APIs and time in tests? Compare mocking `fetch` or modules with Mock Service Worker, and describe when over-mocking hurts.

## Clues
- Mocking at the network boundary keeps application code real.
- Module mocks are hoisted; they replace implementations globally for the file.
- Timers and dates must be faked deliberately and restored.

## Interview Answer
I prefer to mock at the boundary the application doesn't own: the network. With Mock Service Worker (MSW) I declare request handlers (`http.get("/api/user", () => HttpResponse.json({...}))`) that intercept at the HTTP level in Node (via `setupServer`) or in the browser, so the app's real `fetch`, React Query or API client code runs unchanged, and I can override handlers per test to simulate errors, delays or empty states. For modules, `vi.mock`/`jest.mock` replaces imports (hoisted above imports), which is useful for things like `next/navigation`, analytics, or heavy dependencies, but it couples tests to import structure. `vi.fn`/`vi.spyOn` track calls and set return values; fake timers (`vi.useFakeTimers`) and `vi.setSystemTime` control timeouts and dates; browser APIs missing in jsdom (`matchMedia`, `IntersectionObserver`, `ResizeObserver`, `scrollTo`) are stubbed in setup files. I avoid mocking what I'm trying to test, internal functions or child components unless there's a good reason, because that makes tests pass while real wiring is broken.

## Explanation
### Network with MSW (v2)

```ts
// test/server.ts
import { setupServer } from "msw/node";
import { http, HttpResponse, delay } from "msw";

export const handlers = [
  http.get("/api/user", () => HttpResponse.json({ id: 1, name: "Asha" })),
  http.post("/api/cart", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ok: true, items: [body] }, { status: 201 });
  }),
];

export const server = setupServer(...handlers);
```

```ts
// vitest.setup.ts
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));   // fail on unmocked requests
afterEach(() => { server.resetHandlers(); cleanup(); });
afterAll(() => server.close());
```

Per-test overrides:

```tsx
test("shows an error when the API fails", async () => {
  server.use(http.get("/api/user", () => HttpResponse.json({ message: "boom" }, { status: 500 })));
  render(<Profile />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
});

server.use(http.get("/api/user", async () => { await delay(200); return HttpResponse.json(user); }));   // loading states
server.use(http.get("/api/user", () => HttpResponse.error()));                                           // network failure
```

Benefits: same handlers reused in Storybook, Vitest and the browser dev environment; request assertions (`request.json()`) test payloads; works with `fetch`, axios, TanStack Query without code changes. In jsdom environments ensure `fetch` exists (Node 18+ has it) and use absolute URLs or configure `baseURL`.

### Module mocks

```ts
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams("tab=billing"),
}));

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
import { track } from "@/lib/analytics";
expect(track).toHaveBeenCalledWith("checkout_started", { total: 42 });
```

- `vi.mock` is hoisted above imports; use `vi.hoisted` for variables referenced in the factory.
- Partial mocks: `vi.mock("./utils", async (orig) => ({ ...(await orig()), slow: vi.fn() }))`.
- Reset between tests: `vi.clearAllMocks()` (calls), `vi.resetAllMocks()` (implementations), `vi.restoreAllMocks()` (spies); enable `restoreMocks` in config.
- Jest equivalents: `jest.mock`, `jest.fn`, `jest.spyOn`.

### Time and randomness

```ts
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2025-01-01T10:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });

test("debounced search", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<Search />);
  await user.type(screen.getByRole("searchbox"), "react");
  await vi.advanceTimersByTimeAsync(300);
  expect(await screen.findByText("3 results")).toBeInTheDocument();
});
```

Seed or stub `Math.random`/`crypto.randomUUID` when output must be deterministic.

### Browser APIs missing in jsdom

```ts
// setup
window.matchMedia ??= (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false });
class RO { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver ??= RO as any;
Element.prototype.scrollIntoView = vi.fn();
```

Or use a real browser environment: Vitest Browser Mode / Playwright component testing for layout-dependent behaviour (jsdom has no layout, so `getBoundingClientRect` returns zeros).

### What not to mock
- The component under test or its direct children (unless expensive/irrelevant, e.g. a chart).
- Your own state management (use the real store with a fresh instance).
- Utilities that are pure and cheap.
- The thing at the other end of a contract you control: prefer contract tests or real staging for E2E.

### Hazards
1. **Mock drift**: the real API changes but mocks don't; mitigate with shared schemas (Zod/OpenAPI-generated handlers) and contract tests.
2. **Order dependence**: leaked mocks/timers between tests; reset in `afterEach`.
3. **Over-specified interactions**: asserting call counts and argument order for internal collaborators.
4. **Hidden global state**: modules caching values at import time defeat per-test mocks (`vi.resetModules()`).
5. **Fake timers + promises**: use async timer helpers (`advanceTimersByTimeAsync`).

## Follow-ups
- **MSW vs mocking `fetch`?** — MSW sits below your code at the network layer, so retries, headers, response parsing and library behaviour are exercised.
- **How do you mock ESM named exports?** — With the module mock factory or `vi.spyOn(module, "fn")` when the module namespace is configurable.

## Common Mistakes
- Mocking `useQuery` hooks instead of the network.
- Not failing on unhandled requests.
- Forgetting to restore timers.

## Tips
- "Mock the boundary, not the code under test."
