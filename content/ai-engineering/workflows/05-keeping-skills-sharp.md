---
title: "How do you make sure you understand every line of AI-generated code you ship?"
level: medium
type: concept
tags: [learning, ownership, code-review, ai-agents]
related: [ai-engineering/when-not-to-use-ai, ai-engineering/reviewing-ai-code, ai-engineering/measuring-ai-impact]
---

## Question
A concern many managers have: engineers who use agents all day lose the ability to write or debug code without them, and start shipping code they don't fully understand. How do you keep your own skills sharp, and how do you make sure you understand what you merge?

## Interview Answer
My rule is that I'm the author of every line in my PR, whoever typed it. If I can't explain a line in code review, I either learn it or rewrite it before merging. In practice I read every diff, ask the agent to explain anything unfamiliar and then check that against the docs, and I write the tricky core logic myself when I'm learning something new. I also deliberately practise without AI: I solve problems and build small features from scratch, and I debug production issues by reading code and using DevTools rather than pasting errors into a chat. The agent makes me faster at things I already understand; it shouldn't replace the understanding.

## Explanation
### Why interviewers ask this
Many companies now run at least one round without AI, or ask you to walk through code you "wrote" with an agent. They want to see that you remain the engineer, not the operator. A candidate who can't explain their own PR is a red flag no matter how productive they look.

### Practical habits

| Habit | What it protects |
|---|---|
| Read every diff before accepting | You notice patterns you don't know |
| "Explain this line" then verify in official docs | Learning without trusting a possible hallucination |
| Write core logic yourself when learning a concept | Muscle memory for syntax and APIs |
| Debug first, prompt second | Your debugging skill, the hardest one to rebuild |
| Regular AI-free practice (DSA, machine coding, small builds) | Interview performance and fluency |
| Retype instead of paste when it's new to you | Forces attention; you notice what each line does |

### A useful test before merging
For each file in the diff, ask yourself:
1. Could I explain *why* this approach, not just what it does?
2. Do I know what happens on the error path and edge cases?
3. If this breaks at 2 a.m., could I debug it without the agent?

If any answer is no, that's your next 15 minutes of learning.

### Use the agent as a tutor, carefully
Agents are excellent at explaining code, generating practice problems and quizzing you. The risk is that explanations can be confidently wrong about version-specific details. Treat explanations as a starting point and confirm in the official docs, especially for fast-moving areas like React and Next.js.

### Balance, not abstinence
The goal isn't to avoid AI. For boilerplate, test scaffolding and repetitive refactors, hand-writing is wasted effort. The point is to hand-write where the learning is, and to always understand what you ship.

## Follow-ups
- **How would you onboard a junior who leans too heavily on AI?** — Ask them to walk through their PRs in review, pair on debugging without AI, and have them write the first version of core logic themselves.
- **What if the agent uses a pattern you've never seen but it works?** — Look it up, understand why it works and whether it fits the codebase's conventions; "it works" isn't enough to merge.
- **How do you stay current when the agent's knowledge is older than your framework version?** — Read release notes and official docs directly, and give the agent version-matched docs as context.

## Common Mistakes
- Claiming you never use AI so you look "pure". It reads as unrealistic in 2026.
- Claiming AI writes everything and you just review. It reads as "can't code without it".
- Trusting an agent's explanation of an API without checking the docs.

## Tips
- Say the ownership rule in one line: "If I can't explain it, I don't merge it."
- Mention one concrete AI-free habit you actually keep, like weekly machine-coding practice. Specifics are believable; generalities are not.
