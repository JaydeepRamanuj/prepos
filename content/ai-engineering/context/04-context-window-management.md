---
title: "The agent gets worse the longer a session runs. What's happening and how do you manage it?"
level: hard
type: scenario
tags: [context-window, compaction, sessions, handoff]
related: [ai-engineering/session-handoff-doc, ai-engineering/when-not-to-use-ai, ai-engineering/subagents-parallel-agents]
---

## Question
You've been in one agent session since morning: a bug fix, then a refactor, then a new feature. By afternoon the agent ignores conventions it followed earlier, re-introduces a bug you already fixed, and references a function you deleted. What's going on, and how do you work to avoid it?

## Clues
- Everything in the conversation is re-read on every turn. What has accumulated there since the morning?
- What happens to earlier details when a long conversation is summarised to make room?
- Where should important state live so it survives a reset?

## Interview Answer
That's context rot. The conversation now holds three unrelated tasks, failed attempts, old file contents and long tool output, and the model gives attention to all of it. Stale versions of files compete with current ones, and when the tool compacts the history into a summary, details like "we decided not to do X" can get lost. My fix is to treat sessions as one task each: I clear or start a new session between unrelated tasks, and before ending a long task I have the agent write a short handoff note with the goal, decisions, current state and next steps, then start fresh from that note. When I do compact, I tell it what to keep. Durable things like conventions go in `AGENTS.md`, plans go in files, and noisy work like big searches or test runs goes to subagents so their output doesn't fill the main context.

## Explanation
### Why quality degrades

```txt
Session context over a day
09:00  [instructions][bug fix ............]
12:00  [instructions][bug fix][refactor ........ failed attempt ... ]
16:00  [instructions][summary of morning][refactor][feature ....... ]
                         ↑ lossy             ↑ stale file versions
```

- **Dilution** — conventions loaded at the start are a smaller share of what the model is attending to.
- **Stale state** — the agent read `cart.ts` at 10:00; it has changed since, but the old version is still in the history.
- **Failed attempts** — wrong approaches stay in context and can be repeated.
- **Lossy compaction** — tools like Claude Code compact automatically as the context fills. The summary keeps the gist but can drop the specific decision that mattered.

Context windows are now very large, so running out is rare. The problem is quality and cost, not space: every turn re-sends the whole history.

### The habits

| Habit | Tool examples |
|---|---|
| One task per session | `/clear` in Claude Code, a new chat in Cursor |
| Check what's loaded | `/context` in Claude Code |
| Compact with a focus | `/compact keep the API changes and the test commands` |
| Restart after repeated failures | Two failed corrections → clear and re-prompt with what you learned |
| Roll back a bad turn | `/rewind` (checkpoints) in Claude Code, or git |
| Persist state in files | `PLAN.md`, `HANDOFF.md`, the PR description |
| Offload noisy work | Subagents for wide searches and long test logs; only a summary returns |

### A handoff note before restarting

```md
<!-- HANDOFF.md (example) -->
Goal: add status filter to OrdersTable (see PLAN.md)
Done: search-params schema, FilterSelect wired, tests for single filter
Decisions: reuse getOrders cache; status lives in the URL, not Zustand
Not working: cache key ignores status, see app/orders/data.ts:42
Next: include status in cache tag, add test for switching filters
Verify with: pnpm vitest run orders && pnpm tsc --noEmit
```

A fresh session that reads this note starts with exactly the right context and none of the noise.

### Where things should live

| Information | Home |
|---|---|
| Conventions for all tasks | `AGENTS.md` / rules |
| The current task's plan | A plan file |
| Progress and decisions | Handoff note, commit messages |
| One-off exploration | The session (and then discard it) |

## Follow-ups
- **Isn't auto-compaction enough?** — It keeps a session going, but it's a lossy summary. For a long task I prefer a handoff note I've reviewed over a summary I haven't read.
- **How do subagents help with context?** — Each runs in its own context window and returns only a summary, so a 5,000-line test log never enters your main conversation. They cost extra tokens, so use them when the isolation is worth it.
- **What about cost?** — A long, unfocused session re-sends everything each turn. Clearing between tasks is both cheaper and gives better answers.

## Common Mistakes
- Running one "kitchen-sink" session all day across unrelated tasks.
- Keeping decisions only in chat, where they're lost on compaction or restart.
- Blaming the model ("it got dumber") instead of the context you've given it.

## Tips
- Name it: "context rot". Then give the fix in one line: "one task per session, state in files, fresh start with a handoff note".
- Interviewers like hearing that you check what's actually in context rather than guessing.
