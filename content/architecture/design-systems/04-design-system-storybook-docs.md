---
title: "Documenting and testing a component library with Storybook"
level: medium
type: design
tags: [storybook, documentation, interaction-tests, visual-testing, chromatic, a11y]
related: [architecture/design-system-component-api, testing/accessibility-visual-testing, architecture/version-design-system]
---

## Question
How would you document and test a shared component library with Storybook? Cover story structure, controls, interaction tests, accessibility and visual regression checks, and how Storybook fits CI.

## Interview Answer
Storybook gives each component an isolated workshop where I write stories for every meaningful state (default, variants, loading, error, disabled, long content, RTL, dark theme) using Component Story Format with typed `meta` and `args`. Autodocs generate documentation from TypeScript props and JSDoc, MDX pages hold usage guidelines (when to use, accessibility notes, do/don't), and controls let designers and developers explore props. Stories double as tests: `play` functions with the Testing Library API simulate user interaction and assertions run in the browser via the Storybook test runner/Vitest addon; the a11y addon runs axe on each story; and visual regression (Chromatic or Playwright snapshots) compares screenshots across browsers and themes. In CI I build Storybook, run interaction and a11y tests, publish a preview per PR, and gate merges on approved visual changes. This turns the documentation into the executable spec of the design system.

## Explanation
### A story file

```tsx
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Save", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete" } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const LongLabel: Story = { args: { children: "A very long button label that should wrap or truncate gracefully" } };

export const ClicksOnce: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /save/i }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const KeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole("button")).toHaveFocus();
  },
};
```

### What to cover per component
- **States matrix**: variants × sizes × states (hover/focus via `pseudo-states` addon), loading, error, empty, long text, overflow.
- **Themes and directions**: global toolbar for light/dark, brand, RTL, density; render stories in multiple themes for visual tests.
- **Responsive**: viewport parameters.
- **Composition examples**: realistic compound usage (form, table row) in "patterns" stories.
- **Accessibility**: keyboard stories via `play`, ARIA expectations in assertions.

### Documentation
- **Autodocs** from prop types and TSDoc comments: keep descriptions in code.
- **MDX pages** for principles, tokens, content guidelines, migration notes.
- **Do/Don't** examples, usage guidance, related components.
- **Props table** shows defaults and deprecations (`@deprecated`).
- Publish the static build (`storybook build`) on a stable URL; version docs per release.

### Testing layers in Storybook

| Layer | Tool | Catches |
|---|---|---|
| Interaction | `play` functions + test runner / Vitest browser mode | behaviour regressions |
| Accessibility | `@storybook/addon-a11y` (axe) | rule violations per story |
| Visual | Chromatic/Percy/Playwright screenshots | unintended style changes across browsers/themes |
| Unit/types | Vitest + `expectTypeOf` | API/typing contract |
| Coverage | Storybook coverage report | untested states |

### CI flow
1. `npm run build-storybook`.
2. Run `test-storybook` (interactions + a11y) against the static build with Playwright.
3. Upload to Chromatic for visual diffs; require approval.
4. Deploy a preview URL on the PR for designers/QA.
5. On release, publish docs.

### Governance
- Definition of done for a component: stories for all states, docs, a11y checks, visual baseline, tokens only (no hardcoded values), keyboard behaviour tested.
- Designers review in Storybook previews; Figma Code Connect or links map design components to code.
- Keep stories fast and deterministic (mock data, no network, fixed dates) to avoid flaky visual tests.

### Pitfalls
- Stories that depend on global app context (router, providers) without decorators: provide mock providers via decorators.
- Huge story matrices slowing CI: group states, use the "Docs" page for exploration and a subset for visual tests.
- Docs drifting from code: derive from types and tests rather than hand-written tables.
- Storybook config rot: pin versions, keep builder aligned with the app's bundler (Vite/Webpack).

## Follow-ups
- **Storybook vs Ladle/Histoire?** — Lighter alternatives with fewer features; Storybook has the richest ecosystem (addons, Chromatic, test runner).
- **Can stories replace unit tests?** — They cover UI states and interactions well; keep unit tests for pure logic and hooks.

## Common Mistakes
- Only a "default" story per component.
- No tests, so docs rot.
- Flaky visual snapshots from dynamic data.

## Tips
- Emphasise "stories are the executable spec: docs, tests and visual baselines from one source".
