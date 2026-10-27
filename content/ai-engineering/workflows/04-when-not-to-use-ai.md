---
title: "When do you stop using the agent and write the code yourself?"
level: hard
type: scenario
tags: [judgement, debugging, workflow, ai-agents]
related: [ai-engineering/keeping-skills-sharp, ai-engineering/context-window-management, ai-engineering/ai-feature-workflow]
---

## Question
You've been going back and forth with the agent for 40 minutes on a bug in a checkout flow. Each fix it proposes breaks something else, and the diff keeps growing. What do you do now? More generally, when do you decide *not* to use AI for a task?

## Clues
- Think about what happens to the conversation after several failed attempts. Is the agent working from a clean picture any more?
- What does the agent lack that you might have: a reproduction, domain knowledge, a mental model of the flow?
- Some work is about understanding, not typing. Who needs to understand the result?

## Interview Answer
I stop the loop. After two failed corrections the session is polluted with wrong attempts, and more prompting usually makes it worse. I revert to the last good commit, then debug it myself: reproduce the bug reliably, read the code path, add logs or a breakpoint, and find the root cause. Once I understand it, I either fix it directly or start a fresh session with a precise prompt that states the root cause and the fix. More generally I take over when the problem is understanding rather than typing, such as subtle state or concurrency bugs, security-sensitive logic, or a design decision; when the fix is smaller than the prompt; and when I'm learning something new and need it to stick.

## Explanation
### Recognise the spiral

```txt
Healthy loop                    Spiral
prompt → diff → check passes    prompt → diff → new failure
                                  → "fix that" → another failure
                                  → diff grows, you stop reading it
```

Signals you're in a spiral:
- The same bug "fixed" two or three times.
- Each fix touches more files than the last.
- You are approving diffs you haven't fully read.
- The agent proposes changes in code unrelated to the bug.

### What to do, step by step
1. **Stop and revert.** Go back to the last known-good commit. Don't try to rescue a tangled diff.
2. **Reproduce.** A reliable reproduction, ideally a failing test, is worth more than any prompt.
3. **Understand it yourself.** Read the code path, use the debugger and React DevTools, check the network tab. Agents guess well at common bugs but poorly at bugs that depend on runtime state they can't see.
4. **Then decide.** If the fix is a few lines, write it. If it is mechanical but large, start a **fresh** session: "The bug is X caused by Y in `file.ts`. Here's the failing test. Fix it by Z."
5. **Capture the lesson.** If the agent got it wrong because of missing context (a hidden convention, a gotcha), add one line to your project instructions so it does not happen again.

### When AI is the wrong tool

| Situation | Why to do it yourself (or lead closely) |
|---|---|
| Bug depends on runtime state, timing or data the agent can't observe | It will guess; you can measure |
| Security, auth, payments, data migrations | Cost of a subtle mistake is high; you must own every line |
| Architecture or API design decisions | The agent can propose options, but the trade-off is a team decision |
| The fix is smaller than the prompt | Typing the prompt takes longer than the change |
| You're learning a new concept | Writing it builds the mental model you'll need in interviews and incidents |

### Use AI differently, not just less
Taking over doesn't mean ignoring the agent. Use it as a reader instead of a writer: "explain what this reducer does when two actions arrive in the same tick", "list every place that writes to `cart.total`". That keeps you in control while still saving time.

## Follow-ups
- **How do you know when to give up on a session?** — A simple rule: after two failed corrections on the same problem, clear and restart with what you learned, or take over.
- **Isn't writing it yourself slower?** — For the spiral case, no. The 40 minutes already spent shows the agent isn't converging, and understanding the bug is needed either way.
- **How would you explain this to a manager who wants "AI on everything"?** — Measure outcomes (cycle time, defects, rework), not AI usage. Using it where it's strong and skipping it where it's weak is what maximises output.

## Common Mistakes
- Sunk-cost prompting: "one more try" for another 30 minutes.
- Keeping the tangled diff and patching on top of it instead of reverting.
- Saying "I never write code by hand now". Interviewers hear "I can't debug without it".

## Tips
- Give a concrete rule ("two failed corrections, then I reset") and a real story. Judgement plus evidence is exactly what this question tests.
- Mention the reverse too: you also know when *not* to write it yourself (boilerplate, test scaffolding, repetitive migrations).
