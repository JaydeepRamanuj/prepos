---
title: "Why use linters, types and tests as guardrails for AI-written code?"
level: medium
type: concept
tags: [guardrails, linting, typescript, tests, ci, feedback-loops, determinism]
related: [ai-engineering/hooks-for-guarantees, ai-engineering/reviewing-ai-code, ai-engineering/inconsistent-ai-code-fix-the-system]
---

## Question
Your team uses AI agents heavily. Instead of writing longer prompts and instruction files, a senior engineer says "strengthen the deterministic tooling". What does that mean and why does it work?

## Interview Answer
Instructions ask the model to behave; deterministic tools verify that it did. TypeScript strict mode, a linter, a formatter, unit and integration tests, and CI checks give fast, objective, repeatable feedback that doesn't depend on anyone's memory, so they catch the same classes of mistakes whether a human or an agent wrote the code. They also create a feedback loop for the agent itself: when it can run `tsc`, lint and tests, it sees concrete errors, fixes them, and re-runs until green, which makes its output far more reliable than a one-shot guess. The effect compounds as I turn recurring review comments into rules ("don't fetch in `useEffect`" becomes a lint rule; "amounts must be integers" becomes a type or schema), so the system, not the reviewer, enforces conventions. I layer them from fastest to slowest (editor, post-edit hook, pre-commit, CI) and keep the instruction file for what tools can't express, such as intent, architecture rationale and gotchas.

## Explanation
### Why determinism matters with agents
- Models are probabilistic: the same instruction can be followed or missed from run to run, and adherence drops in long sessions.
- Tools give pass/fail signals with exact locations, which the agent can act on precisely.
- Review attention is scarce; machines should catch mechanical issues so humans review design and behaviour.

### The guardrail ladder

| Layer | Examples | Catches | Speed |
|---|---|---|---|
| Types | `strict: true`, `noUncheckedIndexedAccess`, branded ids, Zod at boundaries | wrong shapes, null handling, misuse of APIs | seconds |
| Linter | ESLint rules, `no-restricted-imports`, `react-hooks`, custom rules | convention violations, hook mistakes, forbidden APIs | seconds |
| Formatter | Prettier / Biome | style noise | instant |
| Unit/integration tests | Vitest + Testing Library, MSW | behaviour regressions | seconds–minutes |
| E2E / visual | Playwright, screenshots | user flows, layout | minutes |
| Static analysis / security | CodeQL, Semgrep, `npm audit` | vulnerabilities | minutes |
| Build | `next build` | route, server/client boundary, type errors | minutes |
| CI + branch protection | required checks, review rules | everything, as a gate | minutes |

(Some projects, like this one, deliberately keep the tooling light; the principle is to choose the cheapest deterministic check that catches your actual recurring errors.)

### Turning a review comment into a guardrail
1. A reviewer writes "don't import from `features/orders/internal`" a third time.
2. Add `no-restricted-imports` (or `eslint-plugin-boundaries`) with a clear message.
3. The next agent that violates it gets an error plus the instruction text, and fixes itself.
4. The comment never needs to be written again.

Custom lint messages can double as prompts for the agent: "Use `useQuery` from `@/lib/query` instead of fetching inside `useEffect` (see docs/data-fetching.md)."

### Closing the loop for the agent
Give the agent the commands in `AGENTS.md` (`pnpm typecheck`, `pnpm lint`, `pnpm test path`) and ask it to run them before finishing. A post-edit hook that formats and a stop hook that blocks completion on failing checks turn that from a request into a guarantee. Fast checks (single-file lint, targeted tests) keep the loop quick.

### Making tests useful guardrails
- Test behaviour through public interfaces, not implementation details, so refactors don't fail spuriously.
- Be wary of agents "fixing" a failing test by editing the test, weakening assertions or mocking the problem away. Review test diffs critically, and protect important test files via review rules.
- Write the test first (or have the agent write a failing test that reproduces a bug) so there is an objective definition of done.
- Keep the suite fast and non-flaky; flaky tests teach everyone, including agents, to ignore failures.

### Limits
Tools can't tell you the feature is the right one, the abstraction is good, or the naming is clear; humans still review intent. And passing checks can create false confidence: a green build means "no known violations", not "correct".

## Follow-ups
- **Is a bigger AGENTS.md ever the right fix?** — For information tools can't express (why, gotchas, commands). Rules that can be code should be code.
- **How strict should TypeScript be for agent-written code?** — Strict, because the compiler is the cheapest reviewer; relaxing it for convenience mostly hides agent mistakes.

## Common Mistakes
- Writing ever-longer prompts for rules a linter could enforce.
- Letting the agent edit or delete failing tests to get green.
- Slow checks the agent can't run in its loop.

## Tips
- Phrase it as "if it can be a tool, it shouldn't be a paragraph".
