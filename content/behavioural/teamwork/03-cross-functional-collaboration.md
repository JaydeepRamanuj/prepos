---
title: "How do you work with designers, product managers and backend developers?"
level: medium
type: behavioural
tags: [collaboration, design-handoff, api-contract, stakeholders]
related: [behavioural/disagreement-with-teammate, behavioural/explain-to-non-technical, backend/rest-api-design]
---

## Question
"Tell me about a time you worked closely with a designer, PM or backend developer to deliver a feature. How did you handle gaps or mismatches between what each side expected?"

## Interview Answer
On [feature, e.g. "the new onboarding flow"] at [company], I was the frontend developer working with [a designer, a PM and a backend developer]. The designs were ready, but when I started I found [gap, e.g. "no loading, empty or error states, and the API didn't return a field the design needed"]. My task was to deliver on time without building on assumptions. Before writing code I did a short [30-minute] walkthrough with all three: I listed the missing states and edge cases, the designer added them, and the backend developer and I agreed on the API response shape in a [shared doc / TypeScript type]. That let me build the UI against mock data while the API was being finished. When the PM asked mid-sprint for [a scope change], I showed what it would cost in days and we agreed to move it to the next release. We shipped on [date] with [outcome, e.g. "zero UI bugs reported in QA" / "no rework after API integration"], and the edge-case checklist became part of our handoff process.

## Explanation
### What the interviewer is really assessing
- **Do you surface problems early**, or discover them during integration?
- **Do you respect other disciplines?** Designers and PMs have constraints you don't see.
- **Can you create clarity**: contracts, checklists, written agreements?

### STAR template
- **Situation** — The feature, the people involved, and the mismatch: [feature], [roles], [gap: missing states / unclear requirements / API shape / changing scope].
- **Task** — Your responsibility: [deliver X by Y] without [rework / blocking others].
- **Action** — Concrete collaboration moves: [early review of designs for states and edge cases], [agreed API contract / types / mocks], [made trade-offs visible to the PM in time or scope], [regular short syncs].
- **Result** — Outcome plus a process improvement: [shipped on time], [less rework], [new checklist / template adopted].

### Story ideas from your background
- Design handoff: missing responsive breakpoints, loading/error/empty states, accessibility.
- API contract: agreeing the response shape, building with mocks (e.g. MSW or a typed mock), integrating later.
- Scope creep from a PM or client, handled by making the cost visible.
- Side project: being designer, frontend *and* backend at once, which taught you what each role needs from the others.

### Variants of the question
- "How do you handle a design that's technically hard to implement?"
- "What do you do when the API isn't ready but your deadline is?"
- "Tell me about a time requirements changed mid-sprint."

## Follow-ups
- **What if the designer insists on something expensive to build?** — Explain the cost, offer an alternative that gets 90% of the effect, and let the designer and PM decide on the trade-off.
- **How do you work in parallel with backend?** — Agree the contract first (types or an OpenAPI schema), build against mocks, then run a short integration check.
- **Who has the final say on scope?** — Usually the PM; your job is to make the trade-offs clear and honest.

## Common Mistakes
- Framing other roles as the problem ("the designer didn't think about…").
- Stories where you just "followed the Figma". There's no collaboration in that.
- No process lesson. Interviewers like candidates who fix the system, not only the instance.

## Tips
- Mention **states** (loading, empty, error, partial) explicitly. It instantly signals frontend maturity.
- Say "I wrote it down": a shared doc, typed contract or checklist. Written agreements are what separate senior-leaning engineers.
