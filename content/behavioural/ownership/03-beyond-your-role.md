---
title: "Tell me about a time you went beyond your role"
level: medium
type: behavioural
tags: [ownership, initiative, impact]
related: [behavioural/learning-new-technology-fast, behavioural/why-leaving-current-job, behavioural/mentoring-someone]
---

## Question
"Tell me about a time you took ownership of something that wasn't strictly your job." Variants: "Give an example of initiative", "What's something you improved without being asked?"

## Interview Answer
At [company], I noticed that [problem, e.g. "our dashboard took about 6 seconds to become usable on mid-range phones"], and nobody owned it because it fell between [tickets / teams]. It wasn't assigned to me, but it was hurting [users / a key client]. So I spent [a couple of hours] measuring it first: [Lighthouse and the Performance panel] showed [root cause, e.g. "a huge JS bundle from a charting library loaded on every page, plus unoptimised images"]. I wrote a short note with the numbers and two proposed fixes and took it to my [lead], so it became planned work instead of a side quest. They gave me [N days]. I [lazy-loaded the charting library / moved to next/image / split the bundle], and checked nothing broke with [tests / QA]. The page went from [X s] to [Y s], [metric, e.g. "LCP improved by Z%"], and I added a [bundle-size check / performance budget] to CI so it wouldn't regress. After that, my lead started giving me [performance-related / bigger] tickets.

## Explanation
### What the interviewer is really assessing
- **Ownership mindset.** Do you notice problems and act, or only do assigned tickets?
- **Judgement.** Did you go beyond your role *responsibly*: measured first, told your lead, didn't neglect your own work?
- **Impact.** Did it matter to users or the business?

### STAR template
- **Situation** — The problem nobody owned and why it mattered: [problem], [who it hurt], [why it wasn't anyone's job].
- **Task** — What you decided to take on, and how you made room for it alongside your own work.
- **Action** — [measured / investigated first], [made the case with data to the right person], [implemented], [verified], [prevented regression or documented].
- **Result** — [metric], [user or business outcome], [how the team or process changed], [trust you earned].

### Story ideas from your background
- A performance, accessibility or DX fix (slow builds, flaky tests, no lint rules).
- Writing onboarding docs or a component library because you saw new joiners struggle (your trainer instinct).
- Setting up PR templates, AI agent rules files (AGENTS.md / CLAUDE.md) or shared prompts so the team used AI coding agents more consistently.
- Fixing an API issue on the backend side instead of only working around it on the frontend.
- Trainer: building a reusable project template or automated checks for learners' assignments.

### Variants of the question
- "Tell me about a time you identified and solved a problem nobody asked you to."
- "What's the most impactful thing you've done at your current job?"
- "Have you ever improved a process on your team?"

## Follow-ups
- **How did you balance it with your assigned work?** — Time-boxed the investigation, then got it prioritised officially instead of doing it in secret.
- **What if your lead had said no?** — Accept it, keep the note with the data, and raise it again if the problem grows; no hidden work.
- **Would you do something outside your role that needed another team's code?** — Yes, through their process: a proposal or a PR they review, not a surprise change.

## Common Mistakes
- Going rogue: changing things without telling anyone, or neglecting assigned work.
- Initiative with no measurable impact.
- A tiny example ("I fixed a typo in the docs").

## Tips
- Measure before and after. A before/after number turns a "nice gesture" into an engineering result.
- Close with what changed for the team, e.g. a CI check or doc. That's ownership beyond the single fix.
