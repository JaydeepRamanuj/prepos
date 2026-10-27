---
title: "What makes a good prompt or spec for a coding agent?"
level: medium
type: concept
tags: [prompting, specs, context, ai-agents]
related: [ai-engineering/ai-feature-workflow, ai-engineering/plan-mode-vs-execution, ai-engineering/agents-md-claude-md]
---

## Question
Two engineers on the team use the same agent. One gets clean, mergeable code; the other keeps getting something "close but wrong". Often the difference is the prompt. What goes into a good prompt for a coding task? Show me a bad one and how you would rewrite it.

## Interview Answer
A good prompt gives the agent what it cannot discover by reading the repo: the goal, the constraints, which existing pattern to follow, and what "done" looks like. I name the files or the reference component, describe the symptom or behaviour precisely, say what is out of scope (for example "no new dependencies"), and give a check it can run, like a failing test it must make pass. If I have the thing it needs, an error log, a screenshot, a schema, I paste it instead of describing it. For anything larger than a small change I ask it to come back with a plan first. Vague prompts are fine for exploring ideas, but for code I want merged, specific beats clever wording every time.

## Explanation
The agent is a capable engineer with zero memory of your team's decisions. It can read the code, but it can't read your head. A prompt's job is to close that gap.

### The anatomy

| Part | Example |
|---|---|
| Goal / symptom | "Users are logged out after the access token expires instead of refreshing silently." |
| Where to look | "Token refresh is in `src/lib/auth/refresh.ts`; the fetch wrapper is `src/lib/api.ts`." |
| Pattern to follow | "Follow how `useOrders` handles 401s." |
| Constraints | "No new libraries. Don't change the public API of `apiFetch`." |
| Definition of done | "Write a failing test that reproduces it, then make it pass. `pnpm test auth` must be green." |

### Bad vs good

```txt
Bad:
  fix the login bug

Good:
  Users report being logged out when the access token expires, even though
  the refresh token is valid. Look at src/lib/auth/refresh.ts and how
  apiFetch in src/lib/api.ts retries on 401. First write a failing Vitest
  test that reproduces it, then fix it. Keep apiFetch's signature unchanged
  and don't add dependencies. Show me the test output at the end.
```

The good version takes 30 seconds longer to write and usually saves a round or two of corrections.

### Writing a spec for bigger work
For a multi-day feature, write the spec as a file (`SPEC.md` or a ticket) rather than a chat message. A useful trick is to ask the agent to interview you: "I want to add rate limiting to the public API. Ask me questions until you could write the spec, then write it to SPEC.md." Then start a fresh session that builds from the spec. The spec also becomes what you review against later.

### What not to bother with
- Magic phrases like "you are a senior engineer" or "think step by step". In current tools, how hard the model reasons is controlled by settings such as effort level or a planning model, not by incantations.
- Writing ALL CAPS or "IMPORTANT" repeatedly. If a rule can't be broken, enforce it with a tool (lint rule, hook, test) instead.
- Describing your architecture in prose. The agent can read the code; point it at files.

### Scope is information too
Agents tend to build the smallest thing that satisfies the request. If you want error states, empty states and keyboard support, say so. If you only want a quick prototype, say that. Only you know the intended scope.

## Follow-ups
- **Should you paste whole files into the prompt?** — Reference them (`@path` in Cursor and Claude Code) so the tool loads the current version; paste only things the agent can't reach, like logs or screenshots.
- **How do you handle requirements you're unsure about?** — Ask the agent to list its assumptions or questions before coding, and answer them.
- **When is a vague prompt fine?** — When exploring ("what would you improve here?"), because you will steer each step anyway.

## Common Mistakes
- Leaving out the definition of done, so the agent decides on its own when to stop.
- Over-specifying *how* (line-by-line instructions) while under-specifying *what* and *why*.
- Not mentioning existing helpers, so the agent writes a second version of something you already have.

## Tips
- Remember **G-P-C-D**: Goal, Pattern to follow, Constraints, Done-check.
- In the interview, show the rewrite. A concrete before/after is far more convincing than a list of principles.
