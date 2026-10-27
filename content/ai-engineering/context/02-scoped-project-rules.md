---
title: "How do you scope project rules so the agent gets the right guidance for each part of the codebase?"
level: medium
type: concept
tags: [cursor-rules, claude-rules, context, monorepo]
related: [ai-engineering/agents-md-claude-md, ai-engineering/skills-vs-rules, ai-engineering/inconsistent-ai-code-fix-the-system]
---

## Question
Your Next.js app has very different conventions in different places: Server Actions in `app/`, a design-system package in `packages/ui`, and Playwright tests in `e2e/`. Putting everything in one root instructions file has made it long and noisy. How would you organise rules so the agent only sees what is relevant?

## Interview Answer
I keep the root `AGENTS.md` short with only repo-wide things, and move area-specific guidance into scoped rules that load only when the agent touches matching files. In Cursor that's `.mdc` files in `.cursor/rules/` with a `globs` pattern; in Claude Code it's Markdown files in `.claude/rules/` with a `paths` list in the frontmatter. For a monorepo, a nested `AGENTS.md` in each package also works, since agents read the nearest one. So the UI package's rule about variants and tokens loads only when the agent edits `packages/ui`, and the Playwright conventions only for `e2e/`. That keeps every session's context focused, which improves adherence, and makes each rule small enough that the owning team can maintain it.

## Explanation
### Why scope at all
Everything that loads at session start is read on every task. A rule about Playwright selectors is noise while you fix a CSS bug, and noise makes the important lines easier to miss. Scoping turns "always loaded" into "loaded when relevant".

### Cursor: `.cursor/rules/*.mdc`
Cursor project rules are `.mdc` files (Markdown with frontmatter). Three fields decide when a rule applies:

| Rule type | Frontmatter | Loads when |
|---|---|---|
| Always Apply | `alwaysApply: true` | Every chat |
| Apply to Specific Files | `globs` | A matching file is in context |
| Apply Intelligently | `description` | The agent judges it relevant from the description |
| Apply Manually | none | You `@`-mention it |

```md
---
description: Conventions for the shared UI package
globs: packages/ui/**/*.tsx
alwaysApply: false
---
<!-- .cursor/rules/ui-package.mdc (example) -->
- Components use `cva` variants; never accept a raw `className` for colour.
- Colours and spacing come from tokens in packages/ui/tokens.css only.
- Every component exports its props type and has a story in *.stories.tsx.
```

The older single `.cursorrules` file is legacy; use the rules folder.

### Claude Code: `.claude/rules/*.md`

```md
---
paths:
  - "e2e/**/*.ts"
---
<!-- .claude/rules/playwright.md (example) -->
- Select elements with getByRole or getByTestId, never CSS classes.
- Each test seeds its own data through the /api/test/seed route.
- No fixed waits (page.waitForTimeout). Use web-first assertions.
```

Rules without `paths` load in every session, like `CLAUDE.md`. Path-scoped rules load when Claude reads or edits a matching file.

### Nested AGENTS.md for monorepos

```txt
repo/
├── AGENTS.md              ← commands, repo-wide decisions
├── apps/web/AGENTS.md     ← Next.js app conventions
└── packages/ui/AGENTS.md  ← design-system rules
```

This is the most portable option, since most agents understand nested `AGENTS.md`.

### Writing rules that work
- One topic per file with a clear name (`api-routes`, `testing`, `ui-package`).
- Concrete, checkable statements: "use `getByRole`", not "write good tests".
- Point to a reference file: "follow `ProductsTable.tsx`". One good example beats a paragraph.
- Keep each rule small. Cursor's docs suggest well under 500 lines; much shorter is better.

## Follow-ups
- **Description-based or glob-based?** — Globs are predictable: they load exactly when matching files are touched. Descriptions depend on the agent's judgement, so use them for topics not tied to paths, such as "how we write database migrations".
- **What if rules conflict?** — Fix the conflict. Tools merge rules from several sources and the agent may follow either one; contradictions produce inconsistent code.
- **How do you share rules across tools?** — Put shared content in `AGENTS.md` files, and keep tool-specific rule files thin.

## Common Mistakes
- Marking every rule `alwaysApply: true`, which recreates the giant root file.
- Rules that describe the ideal codebase instead of the real one, so the agent is told one thing and shown another.
- Saving a Cursor rule as `.md` in `.cursor/rules/`; Cursor requires `.mdc`.

## Tips
- Explain it as "always-loaded vs loaded-on-demand context". That framing shows you understand the cost behind the feature.
- A strong close: "If the agent keeps breaking a rule anyway, I enforce it with a lint rule rather than rewording it."
