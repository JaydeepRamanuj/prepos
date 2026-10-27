---
title: "The agent keeps writing outdated framework code. How do you give it the right docs?"
level: advanced
type: design
tags: [documentation, mcp, nextjs, context, training-cutoff]
related: [ai-engineering/skills-vs-rules, ai-engineering/mcp-servers-risks, ai-engineering/reviewing-ai-code]
---

## Question
Your team is on Next.js 16 and React 19. The agent keeps producing `middleware.ts` instead of `proxy.ts`, synchronous `params`, and `next lint` scripts, all patterns from older versions. Design an approach so agents reliably use the APIs of the versions you actually have installed.

## Clues
- Where does the agent's default knowledge come from, and how old is it compared with your dependencies?
- What's the difference between context that's always available and context the agent has to decide to fetch?
- Which tools can tell the agent it's wrong without anyone reading the code?

## Interview Answer
The root cause is that the model's training data predates our versions, so it writes the most common pattern it has seen, which is the old one. I fix that in layers. First, version-matched docs that are always available: Next.js 16.2+ ships its docs in `node_modules/next/dist/docs/`, and 16.3+ adds a managed block in `AGENTS.md` telling agents to read them before writing code. For libraries without bundled docs, I add short "we're on version X; use Y, not Z" lines to `AGENTS.md` or scoped rules, linked to the official pages. Second, on-demand lookup through a docs MCP server or fetching the docs' Markdown or `llms.txt` for things outside that. Third, deterministic feedback: TypeScript, ESLint and the framework's own build errors catch removed APIs, and the agent reads those and corrects itself. Finally, review: outdated patterns are on my checklist for every AI diff.

## Explanation
### Why it happens
A model's knowledge is a snapshot. Frameworks like Next.js changed many conventions recently: `middleware.ts` became `proxy.ts`, `params` and `cookies()` became async, `next lint` was removed in favour of running ESLint or Biome directly. Old patterns dominate the training data, so without help the agent defaults to them.

### Layer 1: always-available, version-matched docs
Next.js now treats this as a first-class problem:

```md
<!-- AGENTS.md: block managed by next dev (Next.js 16.3+) -->
<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know
This version has breaking changes ... Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code.
<!-- END:nextjs-agent-rules -->
```

The docs update automatically when you upgrade Next.js, so they always match the installed version. Next.js's published evaluations found always-available docs beat on-demand skill retrieval for framework knowledge, because the agent doesn't always choose to load a skill.

For other libraries, add short, explicit version notes (example):

```md
# Versions (AGENTS.md excerpt, example)
- React 19: pass `ref` as a regular prop; don't use forwardRef in new code.
- TanStack Query v5: object syntax only, `gcTime` not `cacheTime`.
- Tailwind v4: config lives in CSS via @theme; there is no tailwind.config.js.
```

### Layer 2: on-demand lookup
- **Docs over the network** — many doc sites serve Markdown versions of pages and an `llms.txt` index (Next.js does both).
- **MCP servers** — a docs MCP server gives the agent a search tool. Next.js also provides `next-devtools-mcp`, which connects to the running dev server's `/_next/mcp` endpoint to report real errors, routes and compilation issues.
- **Point at the source** — `@`-reference the specific doc file in the prompt for the task at hand.

### Layer 3: deterministic feedback

```txt
agent writes old API → tsc / eslint / next build fails → agent reads error → fixes
```

TypeScript types from the installed package are the most reliable source of truth an agent has: a removed or renamed API fails to compile. Make sure the agent always runs typecheck and lint, ideally enforced by a hook or CI, not just suggested.

### Layer 4: review
Add "outdated API for our versions?" to your AI-code review checklist, and turn repeated catches into a lint rule (for example `no-restricted-imports` for a deprecated module) or an `AGENTS.md` line.

### Trade-offs

| Approach | Strength | Weakness |
|---|---|---|
| Bundled docs + AGENTS.md pointer | Always matches installed version | Only for libraries that ship docs |
| Version notes in AGENTS.md | Cheap, targeted | Manual upkeep; can go stale |
| Docs MCP / web fetch | Broad coverage | Agent must decide to use it; adds untrusted content |
| Types, lint, build | Deterministic | Only catches what breaks the build |

## Follow-ups
- **Any risk in letting the agent fetch docs from the web?** — Fetched content is untrusted and can contain prompt injection; prefer official sources and bundled docs, and keep permissions tight.
- **How do you keep version notes current?** — Update them in the same PR as the dependency upgrade, and delete them once the old pattern is gone from the codebase and model defaults have caught up.
- **What if the codebase itself still has old patterns?** — The agent copies what it sees. Mark legacy areas in `AGENTS.md` ("don't copy src/legacy/") and migrate gradually, starting with the files agents most often use as examples.

## Common Mistakes
- Assuming a newer model "just knows" the latest version.
- Relying only on an MCP docs tool the agent rarely calls.
- Fixing the same outdated pattern in review every week without adding a lint rule or instruction.

## Tips
- Frame it as "training cutoff vs installed version". It shows you understand *why*, not just the workaround.
- Mention Next.js's bundled docs and the `AGENTS.md` block specifically. It's current, concrete and directly relevant to a Next.js role.
