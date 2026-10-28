---
title: "When do you use subagents or parallel agents, and what are the risks?"
level: hard
type: concept
tags: [subagents, parallel-agents, context, worktrees, orchestration, cost]
related: [ai-engineering/context-window-management, ai-engineering/session-handoff-doc, ai-engineering/plan-mode-vs-execution]
---

## Question
Your agent can spawn subagents, and you can also run several agent sessions in parallel. When is that a good idea, when is it a bad one, and how do you keep the results trustworthy?

## Clues
- A subagent has its own context window, so only its summary returns to the main session.
- Parallel work needs independent tasks and separate working copies.
- More agents means more cost and more to review.

## Interview Answer
A subagent is a separate agent invoked by the main one with its own fresh context and often its own tool set and instructions; it does the work and returns a summary. That makes it ideal for **noisy, self-contained** tasks such as searching a large codebase, reading many files to answer a question, running and triaging a test suite, or reviewing a diff with a clean set of eyes, because the exploration noise stays out of the main context. Parallel sessions (for example several agents each in its own git worktree) fit **independent** tasks like separate bugs or features touching different areas. They are a poor fit when tasks depend on each other, edit the same files, need shared design decisions, or when the task is small enough that spawning costs more than doing. The risks are cost (each agent consumes tokens), merge conflicts, inconsistent conventions, and hidden mistakes in a summary I never verified. So I give each agent a precise brief and a definition of done, isolate writes (worktrees or branches), have the main session verify claims against the real diff and test output, and keep the number of concurrent agents low enough that I can actually review the results.

## Explanation
### What a subagent buys you
```txt
main session context:  plan + decisions + small summaries           (stays clean)
        │ delegate "find every place we call getUser and list the signatures"
        ▼
subagent context:      200 file reads, grep output, dead ends       (thrown away)
        │ returns 10 lines
        ▼
main session continues with the answer
```
It protects the main context from filling with exploration noise, which keeps long sessions sharp.

### Good uses
- **Exploration/research**: "where is auth handled and how?" returns a short map.
- **Verification**: run the test suite and report only failures with likely causes.
- **Independent review**: a reviewer subagent with a checklist and no memory of how the code was written.
- **Specialised roles**: a security reviewer, a docs writer, a migration helper with a narrow tool allowlist.
- **Fan-out over similar items**: apply the same mechanical change to 20 packages when each is independent.

### Bad uses
- Small tasks where the brief is as long as the work.
- Strongly coupled changes (shared types, one design decision) split across agents.
- Anything where the summary is accepted without checking: a subagent can report "done" for work it didn't finish.
- Many writers on the same files.

### Running parallel sessions safely
- One **git worktree** or branch per agent so edits never collide (`git worktree add ../feature-a -b feature-a`).
- Partition by area (frontend vs API vs docs) or by ticket.
- Separate dev server ports, databases and env files if they run the app.
- Merge and run the full checks yourself; resolve conflicts in the main line.
- Cap concurrency; reviewing is the bottleneck, not generating.

### Writing a good brief
```md
Task: find every caller of `formatPrice` and report which pass a string vs number.
Scope: src/ only, read-only. Do not edit files.
Done when: you list file:line, argument type, and whether it handles null.
Return: a table, max 30 lines. Say explicitly if anything was ambiguous or not checked.
```
A brief should state the goal, constraints (read-only, files in scope), the completion criteria and the return format, because the subagent knows nothing about the conversation.

### Trust but verify
- Spot-check cited file paths and line numbers.
- Re-run the tests yourself or via a deterministic command.
- Treat "all tests pass" as a claim until you see the output.
- Prefer agents that return evidence (paths, command output) over opinions.

### Cost and project rules
Each agent has its own token usage; five parallel agents can burn a plan's limits quickly. This repo's own `CLAUDE.md` says to work one track at a time and, if delegation is needed, to use a single cheaper-model subagent at a time. State such limits in the project instructions so agents obey them.

## Follow-ups
- **Subagent vs a new session?** — A subagent returns its result into the current session; a new session is independent and needs a handoff document to share context.
- **How do you stop subagents from making unwanted edits?** — Restrict their tools (read-only), say so in the brief, and use permissions or hooks as enforcement.

## Common Mistakes
- Spawning agents for trivial work.
- Letting parallel agents edit the same files.
- Accepting a subagent's summary without checking.

## Tips
- Say "isolate context for noisy work, isolate files for parallel work".
