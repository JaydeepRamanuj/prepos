# PrepOS — guide for coding agents

@AGENTS.md

Frontend interview-prep app for one developer (React/Next.js dev preparing for 2–3 YOE roles), built so others can sign in too. Content is static Markdown; only user progress is stored in Firebase. Deployed on Vercel. No ESLint, Husky or tests by design — keep it that way unless asked.

## Commands

```bash
npm run dev                     # local dev
npm run build                   # production build — run before pushing app changes
npm run validate                # validate all content + counts per chapter
npm run validate -- react -q    # one track, errors only
```

## Stack

Next.js 16 (App Router, Turbopack, **Cache Components OFF** — plain static generation), React 19, TypeScript, Tailwind v4 (CSS-first, tokens in `globals.css`), Zustand (progress store), Firebase (Google auth + Firestore), cmdk (search), unified/remark/rehype-pretty-code/shiki (markdown → HTML at build time). Fonts are self-hosted via `@fontsource-variable/*` (no `next/font/google`).

Next.js 16 differs from older versions — read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).

## How it fits together

```txt
content/<track>/meta.json            track + chapter definitions (order, group, icon)
content/<track>/<chapter>/NN-slug.md one question per file (format: docs/CONTENT_GUIDE.md)

src/lib/content/   parse.ts (md → sections + validation), load.ts (fs loader, getters),
                   markdown.ts (server-only HTML rendering), types.ts, summaries.ts
src/lib/progress/  store.ts (Zustand + localStorage persist), sync.tsx (auth + Firestore sync),
                   mock.ts (mock round session in sessionStorage)
src/lib/firebase/  client.ts (lazy init; firebaseEnabled=false when env vars missing)
src/app/           routes (all static via generateStaticParams, dynamicParams=false)
src/components/    UI; question/ holds the question-page client pieces; ui/ holds shadcn-style primitives (Radix + CVA)
components.json    shadcn/ui config (new primitives: copy in by hand or with the shadcn CLI)
scripts/validate-content.ts
firestore.rules    users/{uid} readable/writable only by that user
```

Routes: `/` dashboard · `/tracks` · `/tracks/[track]` (filters, chapters) · `/tracks/[track]/[slug]` (question) · `/revise` + `/revise/[track]` (snap-scroll answers) · `/mock` (random round) · `/saved` (revise list, bookmarks, notes) · `/search-index.json` (static index fetched lazily by search, saved and mock).

### Key decisions
The full reasoning (options considered, trade-offs) for each is in `docs/DECISIONS.md` — read it before changing architecture, data shape, rendering or design, and add an entry when you make a new decision of that kind.

- **Question id** = `<track>/<slug>`; slug comes from the filename (`03-event-loop.md` → `event-loop`) and must be unique per track. Progress keys use `toKey(id)` = `track__slug` (Firestore field-path safe). Renaming a slug orphans users' progress for it — avoid.
- **Server/client split:** pages read the filesystem and render markdown on the server at build time; interactive bits (progress buttons, answer reveal, clues, notes) are small client components that receive HTML or children.
- **Progress data** (one Firestore doc `users/{uid}`): `solved`, `revise`, `bookmarks`, `chapters` are maps key → epoch ms; `notes` is key → text. Signed-out progress lives in localStorage; on sign-in it is merged (union) into the account. Writes use `updateDoc` with `FieldPath` for single keys.
- **No SSR of personal data:** components read `useProgress((s) => s.hydrated && …)` so server HTML and first client render match.
- Content is authored in-repo, so rendered HTML is trusted (`Prose` uses `dangerouslySetInnerHTML`).

## Design system

"Study notebook": cool paper + ink-blue, a highlighter-yellow accent used sparingly (answer reveal, revise state, `.hl-mark` underline stroke). Colors are CSS variables in `src/app/globals.css` (light + `.dark`) exposed as Tailwind colors: `paper surface sunken ink ink-2 ink-3 line line-strong blue blue-soft hl hl-soft hl-ink good good-soft`, plus `--lv-easy/medium/hard/advanced`. Fonts: `font-serif` (Literata) for headings and reading text, `font-sans` (Instrument Sans) for UI, `font-mono` (JetBrains Mono) for code. Rendered markdown uses the `.prose-q` class. Difficulty is shown with `LevelPips` (1–4 filled dots + label). Mobile-first: bottom nav on small screens, max reading width ~720px. Use these tokens; don't introduce new colors or fonts ad hoc.

Controls come from `src/components/ui/` (shadcn-style, see D-15). `globals.css` maps shadcn's semantic names onto the notebook palette, so use `bg-primary`, `bg-accent`, `text-muted-foreground`, `bg-popover` and the like in components, and never hardcoded hex or `var(--…)`. Notebook roles (`bg-hl`, `text-good`, `text-lv-*`) stay as named tokens. Use `Button`, `Toggle`, `ToggleGroup`, `Select` and `CommandDialog` rather than raw `<button>`, `<select>`, or `<input type="checkbox">`.

## Writing content

Read `docs/CONTENT_GUIDE.md` (format, levels, types, style) and `docs/CONTENT_PLAN.md` (chapters and target counts) before adding questions. Quality over quantity: verify version-sensitive facts against official docs (React 19, Next.js 16 bundled docs, TanStack Query v5, Zustand v5, Tailwind v4). Run `npm run validate -- <track>` after writing. Don't edit `meta.json` chapter ids once questions exist.

Work one track or chapter at a time. Don't spawn many parallel subagents — they burn the owner's usage limits; if delegation is really needed, use one Sonnet subagent at a time.

## Status (Oct 2026)

App complete; production build passes. Content: 235 of 443 planned questions.

| Track | Done / target | Missing chapters |
|---|---|---|
| javascript | 75 / 75 | complete |
| react | 75 / 75 | complete |
| nextjs | 12 / 72 | rendering, caching, proxy-auth, optimization, deployment, scenarios; rest of routing, data-mutations |
| typescript, html-css, performance, scenarios, testing | 0 | all |
| state | 7 / 20 | tanstack-query, forms; rest of zustand |
| architecture | 10 / 18 | design-systems, data-layer |
| machine-coding | 9 / 20 | features; one component |
| browser-security | 6 / 16 | networking, security |
| backend | 4 / 14 | api-auth, databases |
| ai-engineering | 10 / 20 | agents, quality |
| debugging, behavioural | complete | — |

Run `npm run validate` for exact live counts — update this table when a track is finished.
