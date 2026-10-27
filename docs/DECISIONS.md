# Decisions

Why PrepOS is built the way it is. One entry per decision: context, options considered, what we chose, and the trade-off we accepted. Add a new entry (next number) when you make a decision someone could reasonably question later; if a decision is reversed, mark the old entry **Superseded by D-xx** instead of deleting it.

---

## D-01 Content as Markdown files in the repo

**Context.** ~450 questions, each with several long sections and lots of code. Content changes only when we write more; no one edits it from a UI.

**Options.**
- TypeScript objects (`questions.ts`) — typed, but code inside template literals needs escaping and long prose in TS is miserable to write and review.
- A CMS or database (Firestore, Sanity, Notion) — editing UI, but adds a service, network calls, auth for editors, and content leaves git.
- MDX — components inside content, but heavier tooling and authors can break pages with JSX.
- **Markdown files with YAML frontmatter and fixed `##` sections.** ✅

**Decision.** One file per question at `content/<track>/<chapter>/NN-slug.md`, parsed by `src/lib/content/parse.ts`. Track and chapter metadata in `content/<track>/meta.json`.

**Trade-off.** No type checking of content at write time — covered by `npm run validate`, which enforces frontmatter, section names and clue rules. Content is versioned and diffable, and agents can write it easily.

## D-02 Fully static site; Cache Components off

**Context.** Next.js 16 starters enable `cacheComponents` and `partialPrefetching`. Our content only changes on deploy, and all personal data is client-side.

**Options.**
- Cache Components with `use cache` — powerful for mixed static/dynamic pages, but extra concepts and rules we don't need.
- Static export (`output: 'export'`) — no server at all, but loses the route handler for the search index and some Next conveniences on Vercel.
- **Classic static generation:** `generateStaticParams` + `dynamicParams = false`. ✅

**Decision.** Every route is pre-rendered at build time. Cache Components and Partial Prefetching are turned off in `next.config.ts`.

**Trade-off.** Adding content needs a rebuild (a git push on Vercel). No server compute per request, instant pages, nothing to cache-invalidate.

## D-03 Markdown rendered to HTML on the server at build time

**Context.** Explanations are code-heavy; syntax highlighting must look good in light and dark mode without shipping a highlighter to phones.

**Options.**
- Client-side rendering (react-markdown + Prism in the browser) — bigger JS bundle, slower on mobile.
- **unified → remark-gfm → rehype-pretty-code (Shiki, dual theme) → HTML string at build time.** ✅

**Decision.** `src/lib/content/markdown.ts` (server-only) renders each section to HTML; the `Prose` component injects it. Shiki emits both light and dark colors as CSS variables, switched by the `.dark` class.

**Trade-off.** `dangerouslySetInnerHTML` — acceptable only because content is authored in-repo and trusted. Never render user-submitted text this way.

## D-04 Question identity and progress keys

**Context.** Progress must point at questions in a way that survives reordering.

**Decision.** Question id = `<track>/<slug>`, slug taken from the filename without its `NN-` prefix. Reordering (changing `NN`) or moving a question between chapters of the same track keeps the id. Progress keys use `toKey(id)` = `track__slug` because `/` is awkward in Firestore field paths.

**Trade-off.** Renaming a slug or moving a question to another track orphans existing progress for it. Avoid renames once published; if unavoidable, write a small migration.

## D-05 Progress: Zustand + localStorage, synced to one Firestore document per user

**Context.** Mostly one user, possibly more later. Data per user is small: solved/revise/bookmark flags, chapter completion, notes. Must work offline-ish and without an account.

**Options.**
- Firestore subcollections (one doc per question) — scales to huge data, but many reads/writes and more complex sync.
- Server-side API + database — needs a backend we don't want.
- **Client-only: Zustand store persisted to localStorage, mirrored to `users/{uid}` in Firestore when signed in.** ✅

**Decision.** `src/lib/progress/store.ts` holds maps of key → timestamp (`solved`, `revise`, `bookmarks`, `chapters`) and `notes`. `sync.tsx` on sign-in merges local into remote (union, later timestamp wins; longer note wins), then listens with `onSnapshot`. Each toggle writes one field with `updateDoc` + `FieldPath`. Signing out clears the device copy.

**Trade-off.** One document has a 1 MiB limit — fine for flags and moderate notes, but very long notes for hundreds of questions could approach it; move notes to a subcollection if that happens. Union merge means "unsolve on an offline device" can be undone by the other device's copy — acceptable for this data.

## D-06 Firebase is optional at runtime

**Decision.** `firebaseEnabled` is false when `NEXT_PUBLIC_FIREBASE_*` env vars are missing; the app then hides sign-in and keeps progress on the device. Access control is entirely Firestore rules (`firestore.rules`): a user can read/write only `users/{their uid}`.

**Trade-off.** Web config values are public by design; security depends on rules being deployed. Rules must be published in the Firebase console whenever they change.

## D-07 No personal data in server-rendered HTML

**Context.** Pages are static and shared by everyone; progress lives in the browser. Rendering progress during hydration would cause mismatches.

**Decision.** Components read progress through `useProgress((s) => s.hydrated && …)`. Server HTML and the first client render always show the "empty" state; real progress appears after the persisted store rehydrates.

**Trade-off.** A brief flash of empty progress on first load. Accepted for correctness and simplicity.

## D-08 Google sign-in with a popup, redirect as fallback

**Decision.** `signInWithPopup`, falling back to `signInWithRedirect` only when the popup is blocked. Popup avoids redirect issues with third-party storage partitioning on some mobile browsers.

**Trade-off.** Popups can be blocked; the fallback covers it. The Vercel domain must be added to Firebase Auth's authorized domains.

## D-09 Search index served as a static JSON route

**Context.** Search, Saved and Mock need titles and metadata for every question on the client; pages shouldn't each embed the whole index.

**Decision.** `/search-index.json` (route handler with `dynamic = "force-static"`) is generated at build time and fetched lazily, once, by `loadIndex()` in `components/search.tsx`. Filtering uses cmdk's built-in matcher.

**Trade-off.** One extra request the first time search opens. At ~450 questions the index is small; revisit (e.g. a proper search library) only if search quality becomes a problem.

## D-10 Answer hidden by default, with a reading-mode preference

**Context.** The owner's goal is recall: knowing concepts but forgetting implementation details. Active recall needs an attempt before seeing the answer, but reading on a phone should also be quick.

**Decision.** `AnswerGate` hides the answer until "Reveal answer"; a persisted `autoReveal` preference ("Always show answers") turns it into reading mode. Mock rounds always hide answers. Hard/advanced questions have 2–3 progressive clues.

## D-11 Design: "study notebook" visual identity

**Decision.** Cool paper and ink-blue palette with a highlighter-yellow accent used sparingly (answer reveal, revise state, `.hl-mark`). Literata (designed for long on-screen reading) for headings and content, Instrument Sans for UI, JetBrains Mono for code. Difficulty as 1–4 filled pips plus a label, so it reads without color. Mobile-first with a bottom nav and ~720px reading width. Tokens live in `globals.css`.

**Trade-off.** Serif body text is a deliberate choice for long reading sessions; UI chrome stays sans for density.

## D-12 Self-hosted fonts

**Decision.** `@fontsource-variable/*` packages imported in `globals.css` instead of `next/font/google`.

**Why.** Builds don't depend on reaching Google Fonts (the build sandbox couldn't), and fonts are served from our own domain.

**Trade-off.** We lose `next/font`'s automatic size-adjust fallback metrics, so there can be slight layout shift while fonts load.

## D-13 No ESLint, Husky or tests

**Context.** Owner's explicit choice for speed on a personal project.

**Decision.** Quality gates are `npm run build` (TypeScript strict + Next build) for code and `npm run validate` for content.

**Trade-off.** Regressions are caught by building and by using the app. Revisit if the app gains other users or contributors.

## D-14 Content written track by track, not with many parallel agents

**Context.** The first content pass ran 14 parallel subagents and exhausted the owner's usage limit within a couple of hours, leaving tracks half-finished.

**Decision.** Write one track (or chapter) at a time, checking quality before moving on. If delegation is needed, use one mid-tier (Sonnet) subagent at a time.

**Trade-off.** Slower total throughput; predictable usage and better review of each batch.
