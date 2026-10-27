# PrepOS content guide

Every question is one Markdown file. Quality bar: an answer a strong 2–3 year frontend engineer would give in a good interview, plus the depth to actually understand it. Accuracy beats volume — if you are not sure a fact is current, verify it (official docs) or leave it out.

## Where files go

```
content/<track>/<chapter>/<NN>-<slug>.md
```

- `<track>` and `<chapter>` must exist in `content/<track>/meta.json`. Do not edit `meta.json`.
- `NN` is a two-digit order within the chapter (`01`, `02`, …). Roughly easy → advanced.
- `slug` is kebab-case, unique **within the track**, short and descriptive (`event-loop-order`, `use-effect-cleanup`).
- The question id is `<track>/<slug>` — that is what `related` points at.

## File format

```md
---
title: "How does the event loop decide what runs next?"
level: medium          # easy | medium | hard | advanced
type: concept          # concept | output | implement | debugging | scenario | design | behavioural
tags: [event-loop, promises, microtasks]
related: [javascript/promise-all-polyfill, javascript/microtask-starvation]
---

## Question
The question exactly as an interviewer would ask it. Include the code snippet here for
`output` / `debugging` questions. For `implement` questions, give the spec, signature and
an example usage.

## Clues
- First nudge (points at the right concept without giving it away)
- Second nudge (more concrete)
- Third nudge (optional — nearly the answer)

## Interview Answer
What you would actually say out loud: 3–7 sentences, first person, confident and precise.
No headings. Can include one short inline code reference. For `implement` questions, a
one-paragraph description of the approach (the full code goes in Explanation).

## Explanation
The deep dive. Teach it. Use code blocks with a language (```js, ```tsx, ```ts, ```css,
```bash, ```txt). Use `###` subheadings when long. Tables are welcome for comparisons.
Explain *why*, show the mental model, show the edge cases.

## Follow-ups
- **Follow-up question?** — one or two sentences of answer.
- **Another follow-up?** — answer.

## Common Mistakes
- What candidates get wrong, and why it is wrong.

## Tips
- How to stand out in the interview / how to remember it.
```

### Rules the validator enforces (`npm run validate -- <track>`)

- Frontmatter: `title`, `level`, `type` required; `tags`, `related` are arrays.
- Only these `##` sections, spelled exactly: Question, Clues, Interview Answer, Explanation, Follow-ups, Common Mistakes, Tips.
- `Question`, `Interview Answer`, `Explanation` are required.
- `hard` and `advanced` questions **must** have 2–3 clues. Easy/medium may skip Clues.
- Quote the title in YAML if it contains `:` or starts with a special character. Always quoting is safest.
- Never put a `## ` line at the start of a line inside prose; inside code fences it is fine.

## Levels (calibrated to a 2–3 year frontend engineer)

| Level | Meaning |
|---|---|
| easy | Fundamentals every candidate must nail. Quick, but answer must still be precise. |
| medium | Standard mid-level question. Needs a mental model, not a definition. |
| hard | Requires connecting concepts, writing correct code under pressure, or handling edge cases. |
| advanced | Senior-leaning: internals, trade-offs, design, the "why" behind framework decisions. |

Target mix per track ≈ 15% easy, 35% medium, 30% hard, 20% advanced.

## Types

- `concept` — explain something.
- `output` — "what does this log/render?" Put the snippet in Question; the answer must state the exact output and walk through why, step by step.
- `implement` — write it from memory (polyfills, hooks, components). Explanation contains a complete, correct, runnable solution with comments, then edge cases, then complexity/trade-offs. This is the most important type for this app: the user knows concepts but forgets implementation details, so code must be clean and memorable.
- `debugging` — find and fix the bug in given code; explain the root cause.
- `scenario` — "your page is slow / users report X / PM wants Y — what do you do?" Answer with a structured approach and concrete actions.
- `design` — architecture/system design: options, trade-offs, a recommendation.
- `behavioural` — see the behavioural track instructions.

## Writing style

- Direct, precise, no filler ("Great question!", "In conclusion" are banned). Second person in explanations, first person in Interview Answer.
- Prefer one sharp example over three vague ones. Every code sample must be correct and runnable as shown (TypeScript where natural).
- Use current APIs: React 19 (ref as a prop, Actions, `use`, `useActionState`, `useOptimistic`, React Compiler), Next.js 16 (App Router, `proxy.ts` replacing `middleware.ts`, Cache Components / `use cache`, async `params`/`cookies()`/`headers()`, Turbopack default), Tailwind v4, TanStack Query v5, Zustand v5. When an API changed recently, say what changed — interviewers love "it used to be X, now it is Y because Z".
- Length guide for Explanation: easy 150–300 words, medium 250–500, hard/advanced 400–900. Implement questions may be longer because of code.
- No external images. Diagrams as ASCII inside ```txt fences or as tables.
- Do not copy text from websites; write in your own words.
- `related` should point to 1–4 genuinely related questions (can be in other tracks — check `content/*/meta.json` chapter scopes and existing slugs).

## Exemplar

See `content/javascript/polyfills/01-debounce.md` for a complete example of the bar.
