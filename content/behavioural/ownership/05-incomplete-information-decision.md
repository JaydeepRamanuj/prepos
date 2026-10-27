---
title: "Tell me about a decision you made with incomplete information"
level: hard
type: behavioural
tags: [decision-making, ambiguity, trade-offs, judgement]
related: [behavioural/disagreement-with-teammate, behavioural/mistake-or-failure, behavioural/tight-deadline]
---

## Question
"Tell me about a time you had to make a decision without all the information you wanted. How did you decide, and how did it turn out?"

## Clues
- Pick a decision where waiting had a real cost (a blocked team, a deadline, users affected), so deciding with partial information was the right call.
- Explain how you reduced the risk: what you checked quickly, what assumptions you wrote down, and how you kept the decision reversible.
- The best stories include a point where new information came in and you changed or adjusted your own decision, and say what that taught you.

## Interview Answer
On [project] at [company], we had to choose [decision, e.g. "how to handle real-time updates on the orders screen"] before the backend team had decided their approach, and waiting would have blocked my work for [~2 weeks] before [deadline]. I didn't know the expected [update frequency / user count]. So I listed what I did know, made my assumptions explicit — [e.g. "updates every few seconds are fine; fewer than N concurrent users per account"] — and picked the option that was cheapest to reverse: [e.g. "polling with TanStack Query's refetchInterval behind a small hook"], instead of [WebSockets], which would have needed backend infrastructure we didn't have. I wrote the assumptions in the PR and agreed with my lead on a trigger for revisiting: [e.g. "if we need sub-second updates or polling load becomes an issue"]. [Two months] later, [new information, e.g. "a client needed instant status changes"], so we revisited. Because all the data access went through one hook, switching to [server-sent events] only meant changing that hook, not the [N] components using it. My original choice was only partly right, and that taught me to decide early, keep decisions reversible, and write down the assumptions so it's clear when to revisit.

## Explanation
### What the interviewer is really assessing
- **Bias to action with judgement.** You don't freeze, but you don't gamble either.
- **Risk management.** Did you separate reversible from irreversible decisions (two-way vs one-way doors)?
- **Intellectual honesty.** When new data came in, did you change course, or defend the old decision?

### STAR template
- **Situation** — The decision, what was unknown, and the cost of waiting: [decision], [missing information], [cost of delay].
- **Task** — Make a call that unblocks progress without locking in a bad outcome.
- **Action** — [gathered the quick, cheap data you could], [stated assumptions explicitly], [chose the most reversible option], [isolated it behind an abstraction / feature flag], [agreed a trigger to revisit], [informed stakeholders].
- **Result** — What happened, including what you got wrong, how cheaply you adjusted, and the principle you took away.

### Story ideas from your background
- Choosing a library, data-fetching or state approach before requirements were final.
- Building UI before the API was ready: picking a response shape and mocking it.
- A production issue where you had to pick a fix (rollback vs hotfix) before knowing the full root cause.
- Side projects: picking Firestore vs Postgres before knowing your data's access patterns, then learning what you'd choose now.
- Trainer: designing a course for a batch whose skill level you didn't know in advance, with a diagnostic first session to adjust.

### Variants of the question
- "Tell me about a time you had to act on ambiguous requirements."
- "Describe a time you changed your mind about a decision."
- "How do you decide when you have enough information?"

## Follow-ups
- **How do you decide when to stop gathering information?** — When the cost of waiting exceeds the cost of being wrong, and being wrong is cheap to fix. For irreversible decisions (data model, public API), wait longer and involve more people.
- **What if the decision had been irreversible?** — Escalate earlier, get more opinions, do a time-boxed spike, and document the decision (an ADR-style note).
- **How did you communicate the uncertainty?** — Wrote the assumptions down where the team would see them (PR, ticket, doc), with the revisit trigger.

## Common Mistakes
- A story where you simply guessed and got lucky. Luck isn't a method.
- Never admitting anything turned out wrong. The adjustment is the most valuable part.
- Picking a trivial decision with no real stakes.

## Tips
- Use "reversible" and "assumptions" explicitly. They are the vocabulary of good engineering judgement.
- "I wrote down when we'd revisit it" is a strong, memorable detail.
