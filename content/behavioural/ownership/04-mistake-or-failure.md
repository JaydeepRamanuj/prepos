---
title: "Tell me about a mistake you made or a time you failed"
level: hard
type: behavioural
tags: [failure, accountability, incident, learning]
related: [behavioural/receiving-tough-feedback, behavioural/tight-deadline, behavioural/incomplete-information-decision]
---

## Question
"Tell me about a mistake you made at work. What happened, and what did you do about it?"

## Clues
- Pick a real mistake with real consequences, where the cause was *you*, not the team, the process or bad luck. Small but genuine beats big but vague.
- Spend most of the answer on what you did after: how you contained it, who you told and how fast, and how you fixed the root cause.
- End with a systemic change, a check or habit that stops the same class of mistake happening again, not just "I'll be more careful".

## Interview Answer
At [company], I shipped a change to [feature, e.g. "the filters on our listing page"] that broke [what, e.g. "the page for users with saved filters from the old version"]. It got past review because I'd only tested with fresh data. About [time] after the release, [who, e.g. "support"] reported [N] users seeing [a blank page]. The cause was mine: I'd changed the shape of the data we stored in [localStorage / the URL] and didn't handle the old format. I told my lead immediately and said it was my change, then we [rolled back / shipped a hotfix] within [time]. Next, I fixed it properly with a small migration that read the old format and converted it, and added a test with old-format data. Then I looked at why it happened, not only what. I'd assumed all stored data was in the current shape. So I added a schema check with [Zod] when reading persisted data, with a safe fallback, and added an item to our PR checklist: "does this change persisted data or an API contract?". We haven't had a similar issue since, and I now treat any stored data as untrusted input.

## Explanation
### What the interviewer is really assessing
- **Accountability.** Do you say "I", or "we/they/the process"?
- **Response under pressure.** Fast, honest communication; containment before perfection.
- **Learning that sticks.** A systemic fix, not a promise to try harder.

The mistake itself matters less than the second half of the story. A small bug handled excellently beats a dramatic outage told vaguely.

### STAR template
- **Situation** — What you did and what went wrong, in plain words: [change], [impact: who, how many, how long].
- **Task** — Contain it, fix it, prevent it.
- **Action** — [noticed / was told], [told your lead immediately, owned it], [contained: rollback / hotfix / feature flag], [root-cause fix], [prevention: test, type check, checklist, monitoring, process].
- **Result** — [time to recover], [users affected], [prevention in place], [what you'd now do differently].

### Story ideas from your background
- A production bug from an edge case you didn't test (old data, empty states, timezones, a slow network).
- Merging AI-generated code you didn't fully review, which caused a regression, and the review habit you built afterwards.
- Breaking a build or deploy with an env variable or config change.
- Trainer: a session or assignment that went badly (too advanced, wrong prerequisites), and how you redesigned it.
- Underestimating a task and missing a deadline without warning early enough.

### Variants of the question
- "Tell me about your biggest professional failure."
- "Tell me about a bug you shipped to production."
- "When did you miss a deadline, and why?"

## Follow-ups
- **How did your lead react?** — Describe it honestly. Most leads respond well to fast, owned communication; that's part of the lesson.
- **What would you do differently now?** — Name the specific practice: testing with real or legacy data, feature flags, smaller releases.
- **Tell me about another failure.** — Keep a second story ready, ideally non-technical (communication, estimation).

## Common Mistakes
- A humble-brag ("my mistake was caring too much").
- Blaming others or the process for most of the answer.
- A mistake so serious it raises judgement concerns (deleting production data with no safeguards and no learning).
- Ending with "I learned to be more careful". That isn't a mechanism.

## Tips
- Rough split: 25% what happened, 75% what you did and changed.
- Use "I" for the mistake and "we" for the recovery. It shows ownership and teamwork together.
- The word "prevention" should appear in your result.
