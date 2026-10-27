---
title: "Tell me about a time you worked under a tight deadline"
level: medium
type: behavioural
tags: [pressure, prioritisation, scope, communication]
related: [behavioural/mistake-or-failure, behavioural/cross-functional-collaboration, behavioural/incomplete-information-decision]
---

## Question
"Tell me about a time you had a very tight deadline. How did you manage it, and what did you have to trade off?"

## Interview Answer
At [company], [a client demo / a launch] was moved forward and we had [N days] instead of [M] to ship [feature]. I was responsible for the frontend. Instead of just working late and hoping, I broke the feature into tasks and estimated each one, which showed that the full scope would take roughly [X days]. I took that to my [lead / PM] with a proposal: ship the core flow, [e.g. "create, list and edit"], by the deadline, and move [nice-to-haves, e.g. "bulk actions and the export"] to the following week. They agreed. To move faster I reused our existing [table / form] components, used an AI agent to scaffold [repetitive parts, e.g. "form fields and types"] which I reviewed carefully, and I paired with the backend developer for an hour to lock down the API so we didn't lose time on integration. I gave a short status update every evening. We shipped the core flow [on time / a day early], the demo went well, and the deferred items shipped [N days] later without hurting quality. The lesson I took: under pressure, cutting scope openly beats cutting quality quietly.

## Explanation
### What the interviewer is really assessing
- **Prioritisation.** Can you separate must-have from nice-to-have?
- **Communication under pressure.** Did you raise risks early, or surprise people at the end?
- **Quality judgement.** What did you refuse to cut (tests on critical paths, accessibility, security)?

"I worked 16-hour days" is not the answer they want. Heroics are a sign of poor planning, even when they work.

### STAR template
- **Situation** — What the deadline was, why it was tight: [feature], [original vs new timeline], [stakes].
- **Task** — Your piece and what "done" meant.
- **Action** — [broke down and estimated], [proposed a scope trade-off to the PM/lead], [reused components / tooling / AI scaffolding with review], [unblocked dependencies early], [daily visible status].
- **Result** — [shipped what, when], [quality outcome, e.g. no critical bugs], [what happened to deferred scope], [lesson].

### Story ideas from your background
- A client demo or release date moved forward at your current job.
- A production bug that needed a fix before a deadline.
- Trainer: a batch whose schedule was compressed, so you had to redesign the curriculum to cover the essentials in fewer sessions.
- A hackathon or side project with a fixed deadline.

### Variants of the question
- "How do you prioritise when everything is urgent?"
- "Tell me about a time you missed a deadline." (Use the same story structure, with honesty about what went wrong.)
- "How do you handle pressure?"

## Follow-ups
- **What if the PM refused to cut scope?** — Make the risk explicit in writing (what may slip and what quality risk comes with it), ask for help or more people, and agree what gets tested less.
- **What would you never cut?** — Correctness on critical paths (payments, auth, data loss), basic accessibility, and security.
- **Did you have to work extra hours?** — Being honest is fine ("a couple of late evenings"), but the plan, not the hours, is what made it work.

## Common Mistakes
- Hero stories with no planning or communication.
- Silently cutting quality (no tests, hacks) and calling it a success.
- Not mentioning anyone else, as if you were alone on the project.

## Tips
- Use the phrase "I proposed a scope trade-off". It's what experienced engineers do.
- Mention what you did *not* cut. It shows judgement.
