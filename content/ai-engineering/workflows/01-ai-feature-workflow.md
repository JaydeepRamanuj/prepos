---
title: "Walk me through how you build a feature with an AI coding agent"
level: easy
type: concept
tags: [workflow, explore-plan-implement, verification, ai-agents]
related: [ai-engineering/plan-mode-vs-execution, ai-engineering/prompting-for-code-tasks, ai-engineering/deterministic-guardrails]
---

## Question
You use Cursor or Claude Code every day. Take a normal ticket, say "add a filter dropdown to the orders table", and walk me through exactly how you work with the agent, from reading the ticket to opening the PR.

## Interview Answer
I run a loop of explore, plan, implement, verify, and I stay in charge of each step. First I have the agent read the relevant code (the table component, how filters are done elsewhere, the API it calls) so we are both working from what exists rather than guesses. Then I ask for a short plan: which files change, which existing patterns it will follow, how we will test it. I correct that plan before any code is written, because fixing a plan is cheap and fixing code is not. While it implements, I make sure it can check its own work: typecheck, lint and the relevant tests, and ideally a test it writes first. Finally I review the diff line by line as if a teammate wrote it, run the feature myself, and only then open the PR. The agent writes most of the keystrokes; I own the decisions and the result.

## Explanation
Interviewers ask this to find out whether you *drive* the tool or whether it drives you. A candidate who says "I describe the feature and accept what comes out" is a risk. A candidate who describes a loop with checkpoints is someone they can trust with AI.

### The loop

```txt
  ┌──────────┐   ┌──────┐   ┌───────────┐   ┌────────┐
  │ Explore  │ → │ Plan │ → │ Implement │ → │ Verify │ → review → PR
  └──────────┘   └──────┘   └───────────┘   └────────┘
       ↑______________ corrections loop back ______|
```

| Step | What you ask for | Why it matters |
|---|---|---|
| Explore | "Read `OrdersTable.tsx` and how `ProductsTable` does filters. Don't change anything yet." | The agent copies patterns it has seen. Show it the right ones. |
| Plan | "List the files you'll change and the approach." | You catch wrong assumptions (new state library, wrong API) before they become 300 lines. |
| Implement | Small steps, one concern at a time | Small diffs are reviewable; huge diffs get rubber-stamped. |
| Verify | `tsc`, lint, tests, run the page | The agent stops when the work *looks* done. A pass/fail check tells it whether it *is* done. |

### Give it a check to run
The single biggest quality lever is a command the agent can run that returns pass or fail. Without one, *you* become the test suite and every mistake waits until you notice it. With one, the agent edits, runs the check, reads the failure and fixes it on its own. Ask for evidence too: "show me the test output", not just "tests pass".

### Size the process to the task
Not every change needs all four steps. Renaming a prop or fixing a typo: just ask. A feature touching several files, or code you do not know well: explore and plan first. Skipping the plan on a big task is how you end up with a diff you have to throw away.

### Ownership
Whatever the agent wrote, you are the author of the PR. You should be able to explain every line in review. If you can't, you are not done.

## Follow-ups
- **What do you do when the agent goes in the wrong direction?** — Stop it early (Esc in Claude Code), correct once with more specific context. If two corrections fail, start a fresh session with a better prompt instead of piling on a third.
- **How big should each step be?** — Small enough that you can review the diff in a few minutes. Large tasks get split into ordered steps, each committed separately.
- **Do you let it commit?** — It can stage and draft the commit message, but I read the diff before anything is committed or pushed.

## Common Mistakes
- Jumping straight to "build it" on a multi-file feature, then spending longer untangling the result than writing it would have taken.
- Treating "the agent said it's done" as verification.
- Describing the tool's features instead of your process. The interviewer cares about judgement, not about which button you click.

## Tips
- Name the loop out loud: **explore, plan, implement, verify**. It is short, memorable and shows structure.
- Add one real example from your job ("last week the plan showed it wanted to add a new fetch hook when we already had one, so I pointed it at ours").
