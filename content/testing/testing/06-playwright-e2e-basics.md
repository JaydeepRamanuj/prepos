---
title: "Playwright end-to-end testing: locators, auto-waiting, fixtures and network control"
level: medium
type: concept
tags: [playwright, e2e, locators, auto-waiting, fixtures, trace-viewer, storage-state]
related: [testing/flaky-tests-debugging, testing/test-pyramid-trophy, testing/unit-vs-integration-vs-e2e]
---

## Question
How does Playwright make E2E tests reliable? Cover locators, auto-waiting and web-first assertions, authentication reuse, network interception, fixtures, parallelism and debugging (traces).

## Interview Answer
Playwright drives real browsers (Chromium, Firefox, WebKit). Reliability comes from locators, which are lazily re-resolved queries (`page.getByRole("button", { name: "Save" })`) and from auto-waiting: before acting, Playwright waits for the element to be attached, visible, stable, enabled and able to receive events, and web-first assertions (`await expect(locator).toBeVisible()`) retry until a timeout, so I avoid fixed sleeps. I prefer user-facing locators (role, label, text) over CSS selectors. To keep suites fast I log in once and reuse `storageState`, run tests in parallel with isolated browser contexts per test, mock or stub third-party calls with `page.route`, and use fixtures for setup like seeded data. For debugging I use the trace viewer, screenshots and videos on failure, and `--ui` mode. Playwright's config also supports multiple projects (browsers, devices) and a `webServer` option that starts the app before the run.

## Explanation
### A test

```ts
import { test, expect } from "@playwright/test";

test("user can create a task", async ({ page }) => {
  await page.goto("/tasks");

  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Write tests");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("listitem").filter({ hasText: "Write tests" })).toBeVisible();
  await expect(page).toHaveURL(/\/tasks$/);
});
```

### Locators and auto-waiting
- Prefer: `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `getByTestId` (configure `testIdAttribute`) over CSS/XPath.
- Chain and filter: `page.getByRole("row", { name: "Asha" }).getByRole("button", { name: "Delete" })`.
- Actions (`click`, `fill`, `check`) perform actionability checks: visible, stable (not animating), enabled, receives events, not obscured.
- **Web-first assertions** retry: `toBeVisible`, `toHaveText`, `toHaveCount`, `toHaveURL`, `toBeEnabled`. Non-retrying: `expect(await locator.textContent())` evaluates once; avoid.
- Don't use `waitForTimeout`; wait on conditions (`expect.poll`, `page.waitForResponse`, `waitForURL`).

### Config

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["list"]],
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry", screenshot: "only-on-failure", video: "retain-on-failure" },
  webServer: { command: "npm run build && npm run start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: ".auth/user.json" }, dependencies: ["setup"] },
    { name: "webkit", use: { ...devices["Desktop Safari"], storageState: ".auth/user.json" }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"], storageState: ".auth/user.json" }, dependencies: ["setup"] },
  ],
});
```

Run against a production build (`next build && next start`) for realistic caching and rendering behaviour.

### Authentication once

```ts
// e2e/auth.setup.ts
import { test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_USER!);
  await page.getByLabel("Password").fill(process.env.E2E_PASS!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await page.context().storageState({ path: ".auth/user.json" });
});
```

Tests reuse cookies/localStorage from the file; for different roles, create separate state files.

### Network control

```ts
test("shows an error banner when the API fails", async ({ page }) => {
  await page.route("**/api/tasks", (route) => route.fulfill({ status: 500, json: { message: "boom" } }));
  await page.goto("/tasks");
  await expect(page.getByRole("alert")).toContainText("Couldn't load tasks");
});

const [res] = await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/tasks") && r.request().method() === "POST"),
  page.getByRole("button", { name: "Save" }).click(),
]);
expect(res.status()).toBe(201);
```

Stub third parties (payments, analytics); keep your own backend real in E2E, ideally against a seeded test database or ephemeral environment.

### Fixtures and structure

```ts
// e2e/fixtures.ts
import { test as base } from "@playwright/test";
class TasksPage {
  constructor(private page: Page) {}
  async add(title: string) { /* … */ }
}
export const test = base.extend<{ tasks: TasksPage }>({
  tasks: async ({ page }, use) => { await page.goto("/tasks"); await use(new TasksPage(page)); },
});
```

Page objects or fixtures keep selectors in one place. Each test gets a fresh context (cookies, storage), so tests are isolated; seed data through API calls (`request` fixture) rather than UI steps.

### Debugging
- `npx playwright test --ui` (time-travel UI), `--debug` (inspector), `npx playwright show-trace trace.zip`.
- Trace viewer shows DOM snapshots, network, console, and action log per step.
- `page.pause()`, `codegen` to record locators.
- Run headed with `--headed`; slow with `slowMo` only for debugging.

### Best practices
1. Test critical journeys, not every permutation.
2. Independent tests; no shared state or order dependence.
3. Deterministic data: reset or seed per test; avoid dates/random without control (`page.clock` for time).
4. Accessibility checks with `@axe-core/playwright`.
5. Visual snapshots (`toHaveScreenshot`) for stable components.
6. Run in CI with retries only to detect flakiness, not hide it; track flaky tests.
7. Parallelise by files/shards (`--shard=1/4`).

## Follow-ups
- **Playwright vs Cypress?** — Playwright: multi-browser incl. WebKit, multiple tabs/contexts, built-in parallelism, auto-waiting, multiple languages; Cypress: in-browser runner with a strong interactive experience, historically single-tab.
- **How do you test Server Components?** — Through the browser; Playwright sees the rendered result, which is the point.

## Common Mistakes
- Fixed timeouts (`waitForTimeout`).
- CSS selectors that couple to markup.
- Sharing state between tests.

## Tips
- Explain auto-waiting and web-first assertions; it's why Playwright suites are less flaky.
