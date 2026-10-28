---
title: "Automated accessibility and visual regression testing: what they catch and miss"
level: medium
type: concept
tags: [accessibility-testing, axe, visual-regression, storybook, chromatic, screenshots]
related: [html-css/aria-roles-states, testing/playwright-e2e-basics, testing/test-pyramid-trophy]
---

## Question
How do you add automated accessibility and visual regression checks to a frontend project? What can axe detect, what can't it, and how do you keep visual tests stable instead of noisy?

## Interview Answer
For accessibility I add axe-core checks (jest-axe or vitest-axe in integration tests, `@axe-core/playwright` in E2E, Storybook's a11y addon) to catch rule-based violations like missing labels, invalid ARIA, insufficient colour contrast and duplicate IDs. Automated tools find roughly a third to half of WCAG issues; they can't judge focus order logic, meaningful alt text, keyboard traps, screen reader announcements or cognitive clarity, so I combine them with Testing Library's role-based queries, keyboard interaction tests, and periodic manual checks with a screen reader. For visual regressions I take screenshots of components (Storybook + Chromatic/Percy, Playwright `toHaveScreenshot`) and compare them against baselines; to avoid flakiness I fix viewport, fonts, locale and timezone, disable animations, mask dynamic regions (dates, avatars), wait for fonts and images, and run in the same container image everywhere. Both belong in CI, with a review workflow for approving intentional changes.

## Explanation
### Accessibility checks

```tsx
// Vitest + vitest-axe (or jest-axe)
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
expect.extend(matchers);

test("login form has no detectable a11y violations", async () => {
  const { container } = render(<LoginForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

```ts
// Playwright
import AxeBuilder from "@axe-core/playwright";

test("home page is accessible", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});
```

What axe typically catches: missing form labels and names, invalid or misused ARIA, duplicate IDs, colour contrast (in real browsers, not jsdom), missing alt attributes, heading/landmark issues, tabindex misuse, empty buttons/links.

What it can't verify:
- Whether alt text/labels are meaningful.
- Logical focus order and keyboard operability of custom widgets.
- Focus management after dynamic updates and route changes.
- Screen reader announcements (live regions) and reading order.
- Content clarity, error message helpfulness, cognitive load.
- Zoom/reflow, text spacing, motion preferences.

Complement with:
- Testing Library `getByRole` (fails when semantics are wrong), `user.tab()` and `user.keyboard()` tests for key flows (dialog open/close, menu navigation).
- Manual passes with NVDA/VoiceOver, keyboard-only, 200% zoom, high-contrast mode.
- Linting (`eslint-plugin-jsx-a11y`), Lighthouse, Storybook a11y addon.
- Accessibility acceptance criteria in tickets.

Note: colour contrast checks need a real browser engine; jsdom can't compute layout/styles fully, so run contrast checks in Playwright or Storybook (browser).

### Visual regression

```ts
// Playwright
test("pricing page visual", async ({ page }) => {
  await page.goto("/pricing");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("pricing.png", {
    fullPage: true,
    animations: "disabled",
    mask: [page.getByTestId("current-date")],
    maxDiffPixelRatio: 0.002,
  });
});
```

```js
// Storybook + Chromatic (or Percy): each story is a visual test across browsers/viewports
// Add `parameters: { chromatic: { viewports: [320, 1200] } }`
```

### Keeping visual tests stable
1. **Determinism**: fixed viewport, device scale factor, locale, timezone, colour scheme; freeze time; seed data.
2. **Fonts**: self-host and wait for `document.fonts.ready`; use the same OS/container for baselines (Playwright's Docker image) because rendering differs across platforms.
3. **Animations**: `animations: "disabled"`, `caret: "hide"`, honour `prefers-reduced-motion`.
4. **Dynamic content**: mask timestamps, avatars, ads; mock network.
5. **Granularity**: test components/states in isolation (Storybook) rather than whole pages with lots of noise; full-page snapshots for a few key pages.
6. **Thresholds**: small pixel-ratio tolerance for anti-aliasing; avoid large tolerances that hide real regressions.
7. **Workflow**: baselines committed (Playwright) or stored in the service (Chromatic); PR reviewers approve visual diffs; update snapshots deliberately (`--update-snapshots`).

### Costs and value

| | Accessibility (axe) | Visual regression |
|---|---|---|
| Setup | easy | moderate; infra for stable baselines |
| Noise | low | can be high without discipline |
| Catches | semantic/structural rule violations | unintended style changes, layout breaks, cross-browser differences |
| Misses | UX-level issues | behaviour, accessibility |
| Best location | integration tests, E2E, Storybook | design system components and key pages |

### Design system angle
For a component library, combine Storybook stories (documentation + states), interaction tests (play functions), axe checks, and visual snapshots across themes (light/dark) and viewports; this gives broad coverage cheaply.

## Follow-ups
- **Does passing axe mean WCAG compliant?** — No; it means no detectable automated violations. Manual review is required.
- **Why do visual tests differ between machines?** — Font rendering, GPU/anti-aliasing, OS differences; use the same container.

## Common Mistakes
- Only running axe on the initial page state (not on open dialogs, error states).
- Huge full-page screenshots with dynamic content.
- Blindly updating snapshots.

## Tips
- Say what automation can't catch; it shows maturity.
