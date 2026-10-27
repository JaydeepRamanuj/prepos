---
title: "Why separate planning from execution when working with an agent?"
level: medium
type: concept
tags: [plan-mode, planning, models, ai-agents]
related: [ai-engineering/ai-feature-workflow, ai-engineering/prompting-for-code-tasks, ai-engineering/session-handoff-doc]
---

## Question
Many teams now use a "plan first, then execute" workflow: plan mode in Claude Code, or a stronger reasoning model to write a plan and a cheaper or faster one to carry it out. Why does that split help, and when would you skip it?

## Interview Answer
Planning and executing are different jobs. Planning is where the expensive mistakes happen: wrong assumptions about the data model, picking a new library when one exists, touching ten files when two would do. In plan mode the agent can read and research but cannot edit, so I get a written plan I can review and correct while it is still cheap to change. Once I approve it, execution is mostly mechanical, so a faster or cheaper model can follow the plan, and the plan doubles as a checklist and a handoff document. I skip planning for small, well-understood changes like a rename or a one-file fix, because there the plan costs more than it saves.

## Explanation
### What plan mode actually does
In Claude Code, plan mode is a permission mode: the agent can read files and run read-only commands to research, but file edits are not auto-approved. It ends with a proposed plan you approve, edit or reject. You cycle modes with `Shift+Tab`. Cursor has a similar Plan mode for its agent. The tool names differ, but the idea is the same: **research and propose, no writes**.

### Why the split works

```txt
Cost of fixing a wrong decision
  in the plan        ▏ edit one bullet
  in the code        ▇▇▇▇▇▇ revert, re-prompt, re-review
  after merge        ▇▇▇▇▇▇▇▇▇▇▇▇▇ bug, rollback, incident
```

1. **Cheaper corrections.** A plan is 20 lines you can read in a minute. A wrong diff is 400 lines you have to read *and* throw away.
2. **Forces the agent to explore first.** Without a plan step agents often start writing immediately based on assumptions.
3. **Reusable artifact.** Save the plan to a file. It becomes the checklist for execution, the thing a reviewer checks against, and the handoff note if you start a fresh session.
4. **Right model for each job.** Planning benefits from the strongest reasoning; executing a clear plan often does not. Using a cheaper model for execution saves cost and time.

### What a good plan contains

```md
## Plan: add status filter to OrdersTable   (example)
1. Add `status` to the search params schema in `app/orders/search-params.ts`
2. Reuse `<FilterSelect>` from `components/filters/` (same as ProductsTable)
3. Pass `status` through `getOrders()`; the API already supports it
4. Tests: extend `orders-table.test.tsx` with a filter case
Out of scope: multi-select, saving filters to the user profile
Risks: `getOrders` is cached; confirm the cache key includes `status`
```

Notice it names existing code to reuse, lists what is out of scope and calls out a risk. If the plan doesn't mention any of your existing code, it didn't explore enough.

### When to skip it
- One-line or one-file changes where you can describe the diff yourself.
- Exploratory spikes you will throw away.
- When you already wrote the spec yourself and the plan would just restate it.

## Follow-ups
- **What if the agent deviates from the approved plan?** — Stop it and ask why. Sometimes it found a real reason; then update the plan. Otherwise point it back at the plan file.
- **Do you plan in the same session you execute in?** — For big work I save the plan to a file and start a fresh session for execution, so the context holds the plan rather than all the dead ends from research.
- **Does a more expensive model always plan better?** — Usually for ambiguous, cross-cutting work; for a clear spec the difference is small. Match the model to the uncertainty, not to habit.

## Common Mistakes
- Approving a plan without reading it, which wastes the whole point of the step.
- Planning trivially small tasks, which slows you down and makes the process feel like overhead.
- Keeping the plan only in chat, where it gets lost when the session is compacted or cleared.

## Tips
- One-liner: "Plans are cheap to change, code is expensive to change. So I review the plan hardest."
- Mention that the saved plan doubles as a review checklist. It shows you think about the whole lifecycle, not just generation.
