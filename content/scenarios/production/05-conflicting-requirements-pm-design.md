---
title: "Product, design and engineering want conflicting things on a deadline"
level: medium
type: behavioural
tags: [communication, trade-offs, prioritisation, stakeholders, scope, negotiation]
related: [scenarios/legacy-code-no-tests, behavioural/disagreement-with-teammate, scenarios/feature-flags-rollout]
---

## Question
Design wants a custom animated multi-step onboarding with pixel-perfect transitions, product wants it live in two weeks for a launch, and you estimate the full version at five weeks, with accessibility and performance concerns. How do you handle it?

## Interview Answer
I'd turn the conflict into an explicit trade-off conversation grounded in goals instead of arguing positions. First, clarify the outcome: what business metric must the launch move (activation rate, completion), what is truly fixed (launch date, legal copy) and what is flexible. Then break the work into slices and show options with cost and risk: for example, a "launch version" with the core steps, accessible controls, and a simple CSS transition using existing components; a "polish" phase adding custom animation after launch; and what we'd lose by cutting each item. I'd bring evidence (estimates, a quick prototype, performance and accessibility implications such as `prefers-reduced-motion`), propose measurable success criteria, and ask product and design to decide on priorities together, documenting the decision. During delivery I'd keep visibility through demos, use feature flags to ship incrementally, and protect non-negotiables like accessibility and performance budgets. After launch I'd review the data to decide whether the polish phase is worth doing.

## Explanation
### Reframe as goals and constraints
| Stakeholder | Likely goal | Concern |
|---|---|---|
| Product | hit the launch date, move a metric | scope and timeline |
| Design | cohesive, high-quality experience | fidelity and brand |
| Engineering | maintainable, accessible, performant | risk and effort |

Ask questions: What happens if we launch with a simpler transition? What is the expected lift from the animation? What if we slip a week? Is the date tied to a campaign, contract or conference?

### Show the option space
| Option | Scope | Time | Risks |
|---|---|---|---|
| A: Full custom | bespoke animations, gesture support | 5 weeks | misses launch |
| B: Launch slice | core flow with existing components and simple fade/slide | 2 weeks | less delight at launch |
| C: Phased | B at launch, A's polish in the following sprint behind a flag | 2 + 2 weeks | needs capacity commitment |

Recommend one (usually C) and explain why using shared goals. Make trade-offs visible: "Cutting the custom page-turn effect saves 8 days; the accessibility and performance work stays."

### Protect the non-negotiables
- Accessibility basics: focus management between steps, labels, keyboard operation, `prefers-reduced-motion` support.
- Performance budgets (animation libraries add weight; prefer CSS transitions or the View Transitions API when sufficient).
- Error and loading states, analytics events to measure the funnel.
Present these as quality requirements, not preferences.

### Process tools
- **Quick prototype or spike** (1–2 days) to de-risk complex animation and give design something concrete.
- **Design/engineering pairing** to find cheaper ways to achieve the same feel.
- **Component reuse** from the design system; agree on tokens and motion standards.
- **Decision record**: short note of options, decision, owner, and revisit date.
- **Feature flag + staged rollout** so partial work can ship safely.
- **Regular demos** for early feedback and to avoid late surprises.

### Handling disagreement
Disagree openly but respectfully; use data and user impact; seek a decision-maker when stuck (e.g. product owner for scope, design lead for visual standards); commit once a decision is made; and revisit with outcomes. Avoid silently over-delivering or under-delivering, and avoid heroics that cause burnout.

### After launch
Measure completion and drop-off, collect feedback, and decide whether the polish phase has ROI. Update estimates and process (earlier design/engineering alignment, discovery for animation-heavy work).

## Follow-ups
- **What if product insists on all of it by the deadline?** — State the consequences clearly (quality risk, overtime, accessibility gaps), propose what to cut or add people if possible, escalate for a decision, and document it.
- **What if design disagrees with your simplification?** — Compare against user value; propose a user test or A/B test, and agree on a follow-up phase.

## Common Mistakes
- Saying "no" without alternatives.
- Quietly cutting accessibility or performance.
- Agreeing to everything and then missing the date.

## Tips
- Use the structure: clarify goal → options with trade-offs → recommend → document → review.
