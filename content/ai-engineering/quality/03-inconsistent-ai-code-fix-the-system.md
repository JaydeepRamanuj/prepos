---
title: "The agent writes inconsistent code across the codebase. Do you fix the prompt or the system?"
level: hard
type: scenario
tags: [consistency, conventions, agents-md, linting, templates, examples, scaffolding]
related: [ai-engineering/agents-md-claude-md, ai-engineering/deterministic-guardrails, ai-engineering/scoped-project-rules]
---

## Question
Different features written with AI agents use different fetching styles, folder layouts and error handling. Reviewers keep leaving the same comments. How do you stop this at the root rather than correcting each PR?

## Clues
- Models imitate the code they see, so inconsistent code teaches inconsistency.
- Rules are most effective when they are checked, close to the code, and demonstrated by examples.
- Reduce the number of valid ways to do a thing.

## Interview Answer
Inconsistency is a symptom of the system, not of one prompt. The agent reads whatever it finds nearby and copies it, so a codebase with three data-fetching patterns yields a fourth. I fix it in layers. First, **decide** the one preferred pattern for each recurring concern (data fetching, forms, errors, file layout) and record it briefly with why. Second, **make the right way the easy way**: a golden example module, templates or generators for new features, and shared helpers the agent will find. Third, **enforce** it with deterministic checks (lint rules and import boundaries, type constraints, tests) so deviations fail fast with a helpful message. Fourth, tell the agent about it where it will read: a short `AGENTS.md` pointing at the reference implementation, with path-scoped rules for specific areas. Fifth, **reduce the bad examples**: migrate or clearly mark legacy code ("don't copy from `src/legacy`") so the model stops learning from it. And measure whether the repeated review comments disappear.

## Explanation
### Diagnose first
Collect the last 20 review comments and group them: formatting, architecture, naming, data fetching, error handling, tests, security. Each cluster suggests a different fix.

| Cluster | Best fix |
|---|---|
| Formatting/imports | formatter, import sorting, hook on edit |
| Forbidden APIs/imports | lint rule (`no-restricted-imports`, `no-restricted-syntax`) |
| Layering/boundaries | boundaries plugin, folder conventions, dependency-cruiser |
| Data-shape mistakes | types, Zod schemas, branded types |
| Repeated architecture choice | reference module + template + short rule |
| Domain gotchas (units, flags) | `AGENTS.md` entry or code comment near the hazard |
| Missing tests | test template, CI coverage on changed files, checklist |

### The layers

1. **Decide and write down** (in `docs/` or ADRs): "Server state uses TanStack Query hooks in `features/*/api`. Components never call `fetch`."
2. **Golden path**: a small, well-written feature (`src/features/_example`) and a generator (`pnpm gen:feature orders`) producing the standard structure. Agents copy what they see; give them the right thing to see.
3. **Enforce**:
   ```js
   // eslint.config.js (excerpt)
   {
     rules: {
       "no-restricted-syntax": ["error", {
         selector: "CallExpression[callee.name='fetch']",
         message: "Don't call fetch in components. Use a hook from features/*/api (see docs/data-fetching.md).",
       }],
     },
   }
   ```
   The error message becomes the agent's instruction at exactly the moment it errs.
4. **Instruct concisely**: in `AGENTS.md`, list commands, the golden-path pointer and top gotchas, not an essay. Use scoped rules (directory-level instruction files or path-matched rules) so API-layer rules load only when working there.
5. **Clean up the examples**: refactor the outlier patterns, delete dead code, and mark legacy areas explicitly.
6. **Verify**: ask the agent to implement a small feature in a fresh session and check the result against the standard. Iterate on the system, not just the prompt.

### Anti-patterns
- Writing a 600-line instruction file: attention dilutes, and rules conflict.
- Fixing it per PR with comments only.
- Banning patterns in prose that a tool could enforce.
- Leaving three old patterns in place "for now" with no marker.

### Measuring
Track repeated review comment categories, time to merge, and the number of lint-rule violations caught pre-review. If a category stops appearing, the fix worked.

### Connection to onboarding
The same measures help new human hires: they also imitate nearby code. A codebase that's easy for an agent to follow is usually easier for people too.

## Follow-ups
- **What if the team disagrees on the standard?** — Decide with an ADR; consistency matters more than which option wins. Revisit if evidence shows pain.
- **Does the agent need to know the reason behind a rule?** — A one-line why helps it handle edge cases, as in "because requests must be cancellable".

## Common Mistakes
- Treating each bad output as a prompting failure.
- Rules without enforcement.
- Legacy code that nobody labelled as legacy.

## Tips
- End with "the model imitates the repo, so improve the repo".
