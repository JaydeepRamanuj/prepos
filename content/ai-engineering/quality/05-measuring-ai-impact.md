---
title: "How do you measure whether AI tools actually improve engineering outcomes?"
level: advanced
type: scenario
tags: [metrics, productivity, dora, quality, rework, adoption, measurement]
related: [ai-engineering/reviewing-ai-code, ai-engineering/deterministic-guardrails, ai-engineering/when-not-to-use-ai]
---

## Question
Leadership asks whether the team's investment in AI coding tools is paying off. Which metrics would you use, which would you avoid, and how do you run the measurement honestly?

## Clues
- Lines of code and acceptance rates measure activity, not outcomes.
- Faster generation can shift cost to review, rework and incidents.
- Perceived and measured productivity can differ.

## Interview Answer
I would measure outcomes across the whole delivery loop, not output volume. Good signals are flow metrics (lead time from first commit to production, PR cycle time, deployment frequency), quality and stability (change failure rate, rollbacks, bug escape rate, incident count, time to restore), rework (code churn shortly after merge, reverted PRs, review rounds), and developer experience (survey-based satisfaction, perceived friction, time on toil). I avoid vanity metrics such as lines generated, suggestion acceptance rate or "percent of code written by AI", which can rise while value falls. To be honest about causality, I establish a baseline before rollout, compare similar work or teams where possible, watch for downstream costs like longer reviews and more bugs, and combine quantitative data with qualitative feedback and task-level experiments. A fair conclusion is often nuanced: strong gains on boilerplate, tests, migrations and exploration; mixed or negative on complex, unfamiliar or high-risk work; and the benefit depends heavily on guardrails, context quality and team practices.

## Explanation
### What to measure

| Dimension | Metrics | Notes |
|---|---|---|
| Speed | lead time for changes, PR cycle time (open → merge), time to first review, deployment frequency | DORA-style; compare before/after for similar work |
| Quality | change failure rate, escaped defects, hotfixes, rollbacks, incident count | faster but flakier is not a win |
| Rework | PRs reverted, code churn within 2–4 weeks, review rounds, size of fix-up commits | generated code that needs heavy reshaping costs time |
| Review load | reviewer time per PR, PR size, review queue length | a common hidden bottleneck |
| Maintainability | duplication, test coverage of new code, lint/type error trends | AI can inflate duplication |
| Security | vulnerabilities per KLOC in new code, scanner findings, secrets caught | see the AI security question |
| Developer experience | survey scores (satisfaction, flow, cognitive load), onboarding time | perception matters but isn't the whole picture |
| Cost | tool spend, tokens per merged PR, time saved per task type | value per dollar, not just usage |
| Adoption | active users, usage by task type | context for the above, not success itself |

### Metrics to distrust
- **Lines of code / commits / PR count**: easily inflated by generation.
- **Suggestion acceptance rate**: measures willingness to press Tab, not value.
- **"% of code written by AI"**: says nothing about correctness or ownership.
- **Self-reported hours saved** alone: people often overestimate; controlled studies have found experienced developers can be slower on familiar, complex codebases while believing they are faster.
- **Individual-level surveillance**: leads to gaming and distrust. Prefer team-level metrics.

### Doing it credibly
1. **Baseline** the key metrics for 1–3 months before changes.
2. **Define hypotheses** by task type ("tests and migrations get faster", "bugs don't increase").
3. **Compare like with like**: similar teams or periods, controlling for seasonality, team changes and release cycles; staggered rollout helps.
4. **Run small experiments**: the same class of tickets done with and without agents, tracking time to merge-quality code including review and fixes.
5. **Collect qualitative data**: retros, interviews, "where did AI waste your time?" and "where did it shine?"
6. **Review incidents** for AI-involved root causes without blame, feeding guardrails.
7. **Report honestly** with ranges and caveats, and iterate on practices (context files, hooks, review norms) and re-measure.

### Typical findings and implications
- Gains concentrate where requirements are clear, patterns exist, and checks are strong.
- Review bottlenecks emerge when PR volume and size rise: set size limits and use automated pre-review.
- Weak guardrails turn speed into rework; investing in tests/types/lint is part of the ROI.
- Skills atrophy and shallow understanding are long-term risks; track onboarding and incident diagnosis ability, and keep practising fundamentals (see the "keeping skills sharp" question).

### Presenting to leadership
Tell a three-part story: what improved (with numbers), what got worse or moved elsewhere (review time, bugs), and what you're changing next. Tie it to business outcomes such as time to ship features, reliability and cost per change.

## Follow-ups
- **Why not just ask developers if they're faster?** — Self-report is useful for experience but is biased; combine it with objective flow and quality metrics.
- **Which single metric would you pick?** — None alone; if forced, change failure rate paired with lead time, since together they show speed without sacrificing stability.

## Common Mistakes
- Celebrating adoption or acceptance numbers.
- Ignoring review time and incident cost.
- Measuring individuals instead of team outcomes.

## Tips
- Say "speed and stability together, with a baseline, and be wary of vanity metrics".
