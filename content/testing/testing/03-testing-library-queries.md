---
title: "React Testing Library: queries, user-event, async assertions and what not to test"
level: medium
type: concept
tags: [testing-library, getByRole, userEvent, findBy, waitFor, accessibility, jest-dom]
related: [testing/test-pyramid-trophy, testing/mocking-msw-vi-mock, html-css/aria-roles-states]
---

## Question
Describe the Testing Library philosophy and query priority. When do you use `getBy`, `queryBy` and `findBy`, why use `userEvent` over `fireEvent`, and how do you test async UI without arbitrary waits?

## Interview Answer
Testing Library encourages tests that resemble how users interact: you query by what users perceive and assert on visible outcomes, not component internals. The query priority is `getByRole` (with accessible name), `getByLabelText`, `getByPlaceholderText`, `getByText`, `getByDisplayValue`, then `getByAltText`/`getByTitle`, with `getByTestId` as a last resort. `getBy*` throws if the element is missing and expects exactly one match, `queryBy*` returns `null` (use for asserting absence), and `findBy*` returns a promise that retries until the element appears (use for async UI). I use `userEvent.setup()` rather than `fireEvent` because it simulates complete user sequences (pointer events, focus, typing, keyboard) and surfaces real accessibility issues. For asynchronous behaviour I `await` `findBy` queries or `waitFor` an assertion rather than sleeping, and I assert through `@testing-library/jest-dom` matchers like `toBeVisible`, `toBeDisabled`, `toHaveAccessibleName`. I avoid testing implementation details (state, instance methods) and snapshot-testing large trees.

## Explanation
### Setup

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";          // or "@testing-library/jest-dom" with Jest

test("submits the form", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/email/i), "asha@example.com");
  await user.type(screen.getByLabelText(/password/i), "s3cret!");
  await user.click(screen.getByRole("button", { name: /sign in/i }));

  expect(onSubmit).toHaveBeenCalledWith({ email: "asha@example.com", password: "s3cret!" });
});
```

### Query priority (from the docs)
1. Accessible to everyone: `getByRole`, `getByLabelText`, `getByPlaceholderText`, `getByText`, `getByDisplayValue`.
2. Semantic: `getByAltText`, `getByTitle`.
3. Test IDs: `getByTestId` (only when nothing else works).

```tsx
screen.getByRole("button", { name: /save/i });
screen.getByRole("heading", { level: 2, name: "Orders" });
screen.getByRole("textbox", { name: "Search" });
screen.getByRole("checkbox", { name: "Remember me", checked: true });
within(screen.getByRole("list")).getAllByRole("listitem");
```

`getByRole` depends on correct semantics, so a failing query often reveals an accessibility bug (missing label, wrong role).

### Query variants

| Variant | No match | One match | Multiple | Async |
|---|---|---|---|---|
| `getBy` | throws | element | throws | no |
| `queryBy` | `null` | element | throws | no |
| `findBy` | rejects after timeout | resolves | rejects | yes |
| `getAllBy` / `queryAllBy` / `findAllBy` | throws / [] / rejects | array | array | |

```tsx
expect(screen.queryByText("Error")).not.toBeInTheDocument();         // absence
expect(await screen.findByText("Saved")).toBeVisible();              // appears later
await waitForElementToBeRemoved(() => screen.queryByRole("progressbar"));
```

### `userEvent` vs `fireEvent`
- `fireEvent.click` dispatches a single DOM event. `userEvent.click` performs hover, pointerdown, mousedown, focus, pointerup, mouseup, click, respecting disabled/hidden state and pointer-events.
- `user.type` types key by key (keydown, keypress, input, keyup), supports special keys `{Enter}`, `{Shift>}`.
- Always `await` user-event calls and create the instance with `userEvent.setup()` before `render`.

### Async and `act`
- `findBy*`/`waitFor` retry (default timeout 1000 ms) and already wrap `act`.
- `waitFor(() => expect(x).toBe(y))`: callback must contain assertions, not side effects; don't put multiple assertions that could pass unrelated; don't wrap `userEvent` calls in `waitFor`.
- Use fake timers carefully: `vi.useFakeTimers()` plus `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
- "not wrapped in act(...)" warnings usually indicate state updates after the test finished or un-awaited async work; fix by awaiting the right query rather than silencing.

### What to assert
- Visible output: text, roles, states (`toBeDisabled`, `toBeChecked`, `toHaveValue`, `toHaveAttribute("aria-invalid", "true")`).
- Calls at the boundaries you own (callbacks passed as props, network requests).
- Not: internal state, component instance, number of renders, CSS class names (unless the class is the contract).

### Providers and utilities

```tsx
function renderWithProviders(ui: React.ReactElement, { route = "/" } = {}) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: ({ children }) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    ) }),
  };
}
```

Create a fresh `QueryClient` per test and disable retries to avoid cross-test leakage and slow failures.

### Debugging
`screen.debug()`, `screen.logTestingPlaygroundURL()`, `prettyDOM`, and the Testing Playground to find the best query; `getByRole` failures print the available roles.

## Follow-ups
- **Why not use `container.querySelector`?** — It ties tests to DOM structure and bypasses accessibility cues.
- **How do you test a component that uses Next.js router/navigation?** — Mock `next/navigation` hooks or wrap in a test provider; for real routing behaviour use E2E.

## Common Mistakes
- Using `getByTestId` by default.
- Forgetting `await` on `user.*` calls.
- Asserting on implementation details.

## Tips
- "Query like a user: role, label, text" is the one-line philosophy.
