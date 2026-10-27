---
title: "Tell me about a time you disagreed with a teammate or your lead"
level: hard
type: behavioural
tags: [conflict, disagreement, decision-making, influence]
related: [behavioural/receiving-tough-feedback, behavioural/cross-functional-collaboration, behavioural/incomplete-information-decision]
---

## Question
"Tell me about a time you disagreed with a teammate or your tech lead on a technical decision. How was it resolved?"

## Clues
- Pick a story about a *technical* decision with real trade-offs on both sides, not a personality clash.
- Show you understood their reasoning before pushing yours. The strongest stories include a point where you changed your own mind, at least partly.
- The result should include the relationship: you still worked well together afterwards, and the decision was based on evidence, not seniority.

## Interview Answer
On [project] at [company], my lead wanted to [their approach, e.g. "add a global state library for the whole app"], and I thought [your approach, e.g. "most of that state was server data and should go into TanStack Query, with small local state for the rest"]. Since it would shape the whole codebase, I didn't want to just argue in Slack. First I asked them why they preferred it, and found a valid concern I hadn't considered: [their concern, e.g. "several screens shared filter state"]. Then I built a small proof of concept on one screen with my approach, and listed the trade-offs for both options in a short doc: [lines of code, re-renders, caching, learning curve]. We reviewed it together. The outcome was a mix: we used [your approach] for server data and [their approach, scoped down] for the shared filters. That turned out to be the right call because [result, e.g. "it removed ~N lines of manual loading/error state and fixed a stale-data bug"]. What I learned is to argue with a prototype and a trade-off table, not opinions, and to be open to the other person being partly right.

## Explanation
### What the interviewer is really assessing
- **Can you disagree without damage?** Professional, evidence-based, respectful.
- **Do you listen?** Candidates who never change their mind in their own story look rigid.
- **Disagree and commit.** If the decision goes against you, do you still execute properly?

### STAR template
- **Situation** — The decision and why it mattered: [project], [decision], [both positions in one line each].
- **Task** — What you wanted: the best technical outcome, not to "win".
- **Action** — The moves that matter: [asked for their reasoning first], [what valid point you found in it], [gathered evidence: prototype / benchmark / doc], [discussed in the right forum], [escalated only if needed].
- **Result** — The decision (yours, theirs or a hybrid), the measurable outcome, the relationship afterwards, the lesson.

If the decision went against you, that's a fine story too: explain how you committed fully, and what happened next.

### Story ideas from your background
- State management choice, data fetching approach, folder structure, using a UI library vs building in-house.
- Whether to refactor now or ship first.
- Accepting an AI-suggested approach vs a hand-written one.
- Trainer days: disagreeing with the curriculum owner about teaching class components vs hooks, or the order of topics.

### Variants of the question
- "Tell me about a conflict at work."
- "What do you do when you're sure you're right but your lead disagrees?"
- "Tell me about a time you changed someone's mind." / "...when someone changed yours."

## Follow-ups
- **What if your lead had still said no?** — Disagree and commit: state your concern once, clearly and in writing, then implement their decision well and revisit only if new data appears.
- **When would you escalate?** — Only for risks beyond preference (security, data loss, legal), and with your lead's knowledge, not around them.
- **How do you handle a teammate who is dismissive in reviews?** — Talk one-to-one, focus on specific comments, ask what standard they expect; involve the lead only if it continues.

## Common Mistakes
- A story where the other person was simply wrong and you were simply right.
- Interpersonal drama ("he was rude") instead of a technical disagreement.
- Claiming you've never disagreed with anyone. That sounds either untrue or passive.
- No outcome, or an outcome where the relationship got worse.

## Tips
- Key phrases: "I asked why first", "I built a small proof of concept", "we agreed on criteria before choosing".
- Hybrid outcomes are the most believable and show you can synthesise.
- Keep the tone warm towards the other person throughout. The interviewer is imagining being that person.
