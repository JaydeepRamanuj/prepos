# Brief for content writers

You are writing interview-prep content for **PrepOS**, a Next.js app at `/home/claude/prepos`.

## Before writing
1. Read `docs/CONTENT_GUIDE.md` completely — it is the format and quality spec.
2. Read the exemplar `content/javascript/polyfills/01-debounce.md`. Match that bar.
3. Skim `docs/CONTENT_PLAN.md` so you know what other tracks cover and do not duplicate them (cross-link with `related` instead).
4. Read the `meta.json` of your track(s).

## The reader
A frontend developer (title: React & Next.js Developer, ~1 year) who previously spent 1.5 years as a web-development trainer. Uses AI coding agents daily, interested in backend. Preparing to interview for roles at a **2–3 year** level at good product companies in India. Key pain point: knows concepts but forgets implementation details and syntax when writing without AI — so code must be correct, clean, and memorable, and explanations must build real mental models.

## Rules
- One question per file, created with the Write tool, in your assigned folders only.
- Hit the target count per chapter (±1 is fine) and the level mix in the guide.
- Questions must be ones real interviewers ask (or close variants) — no trivia nobody asks.
- No duplicates within your chapters; vary angles (concept → implement → output → scenario).
- Version-sensitive facts (React 19, Next.js 16, TanStack Query v5, Zustand v5, Tailwind v4, browser APIs, tooling) must be verified against official docs with WebSearch/WebFetch. If you cannot verify, leave it out.
- After finishing each chapter run `cd /home/claude/prepos && npm run validate -- <track> -q` and fix every error.
- Do NOT run git, install packages, edit `meta.json`, or touch files outside your folders.
- `related`: link to slugs you created or that clearly exist (check with Glob). Warnings for not-yet-existing links are acceptable but keep them few.

## Final report (under 150 words)
Files created per chapter with level counts, the validator result, and any facts you were unsure about.
