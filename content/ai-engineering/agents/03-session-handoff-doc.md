---
title: "How do you hand work between agent sessions without losing context?"
level: medium
type: concept
tags: [handoff, sessions, context, compaction, documentation, continuity]
related: [ai-engineering/context-window-management, ai-engineering/subagents-parallel-agents, ai-engineering/plan-mode-vs-execution]
---

## Question
A large task spans several days and several agent sessions. How do you keep continuity so each new session starts productive instead of re-discovering everything?

## Interview Answer
I externalise the state of the work into files in the repo instead of relying on the chat history. A short **handoff document** (for example `docs/handoff/feature-x.md` or a `PLAN.md`) records the goal, decisions made and why, what's done, what's in progress, what's next, the commands to verify, known problems, and files that matter. At the end of a session I ask the agent to update it from the actual state (git diff, test results), and at the start of the next session I point the new agent at it. This beats relying on automatic compaction or a very long conversation, because summaries drop details, long contexts degrade, and a file is reviewable, versionable and shareable with teammates. For standing information I put it in `AGENTS.md`, for task-specific progress in the handoff file, and I keep the code, tests and commits themselves as the source of truth.

## Explanation
### What goes in a handoff

```md
# Handoff: migrate checkout to Server Actions

## Goal
Replace /api/checkout route handlers with Server Actions; keep behaviour identical.

## Decisions (and why)
- Keep zod schemas in src/features/checkout/schema.ts (shared with the form).
- Do not change the payment provider SDK usage; out of scope.

## Done
- createOrder action + tests (commit a1b2c3d)
- Cart page uses the action

## In progress
- Coupon validation: action written, error mapping not done (src/features/checkout/actions.ts:88)

## Next
1. Map coupon errors to field errors
2. Remove /api/checkout/coupon route
3. Update Playwright test checkout.spec.ts

## Verify
- pnpm tsc --noEmit && pnpm vitest run src/features/checkout && pnpm playwright test checkout

## Gotchas
- Amounts are in paise. The legacy route rounds up; the new code must match.
```

### Why files beat chat memory
- **Compaction is lossy**: automatic summaries keep the gist but drop specifics such as why an approach was rejected.
- **Long contexts degrade**: instructions from hours ago are followed less reliably.
- **Fresh context is cheaper and sharper**: a new session plus a good file often outperforms a bloated one.
- **Shareable**: a teammate or another tool can pick up the work.
- **Reviewable**: you can correct a wrong assumption in the document before the next session builds on it.

### Workflow
1. Work in small chunks; commit at stable points.
2. Before ending (or when context gets heavy), ask: "Update the handoff file based on `git status`, `git diff`, and the last test run. Be specific about what's unfinished."
3. Review and fix the file yourself, as it steers the next session.
4. Start a new session: "Read docs/handoff/checkout.md and continue with the Next list. Ask before changing decisions."
5. Delete or archive the file when the work ships.

### Related tools
- **Plan files** produced in plan mode can double as the handoff.
- **Todo/task lists** inside a session help ordering but don't persist; copy them into the file.
- **Resuming/continuing** a session restores the conversation, which is useful for short gaps but still subject to context limits.
- **Commit messages and PR descriptions** are durable records of intent; write them well.
- **ADR / decisions log** (like this repo's `docs/DECISIONS.md`) captures design reasoning for the long term.

### Pitfalls
- Letting the agent write the handoff from memory instead of from the repo state.
- A giant document: keep it to one page; link to code rather than copying it.
- Stale handoffs that contradict the code: date them and update on each session.
- Putting secrets in it.

## Follow-ups
- **Handoff file or AGENTS.md?** — AGENTS.md is for durable, project-wide guidance; the handoff is temporary task state.
- **Can the agent just read the git log?** — It helps with what changed, but not with decisions, rejected options and what's next.

## Common Mistakes
- Depending on one marathon session.
- Trusting the agent's recollection rather than the diff.
- Never cleaning up old handoff files.

## Tips
- Mention the four headings: goal and decisions, done, next, how to verify.
