---
title: "What are AGENTS.md and CLAUDE.md, and what belongs in them?"
level: easy
type: concept
tags: [agents-md, claude-md, context, project-instructions]
related: [ai-engineering/scoped-project-rules, ai-engineering/skills-vs-rules, ai-engineering/inconsistent-ai-code-fix-the-system]
---

## Question
Your repo has an `AGENTS.md` at the root and a teammate wants to add a `CLAUDE.md` too. What are these files, how do agents use them, and what would you put in them (and keep out)?

## Interview Answer
They are project instruction files that a coding agent loads at the start of every session, like a README written for the agent. `AGENTS.md` is an open, tool-neutral convention read by Cursor, Codex, Copilot's agent, Windsurf and others; `CLAUDE.md` is Claude Code's own file, and Claude Code can also read `AGENTS.md`. Because they're loaded into every session, every line costs attention on every task, so I keep them short and only include what the agent can't work out from the code: the exact commands to install, typecheck, lint and run a single test; decisions that aren't visible in the repo; places where the code is misleading, like a legacy folder not to copy; and anything I've had to correct twice. I leave out architecture descriptions the agent can read for itself, generic advice like "write clean code", secrets, and hard rules that must never be broken, which belong in a lint rule, hook or permission instead.

## Explanation
### How they load
- **AGENTS.md** — plain Markdown, no required format. Agents read the nearest one in the directory tree, so in a monorepo each package can have its own, and the closest file wins for files in that package.
- **CLAUDE.md** — Claude Code loads `CLAUDE.md` (or `.claude/CLAUDE.md`) from the working directory and the directories above it at startup, and ones in subdirectories when it reads files there. A personal, git-ignored `CLAUDE.local.md` is for your own preferences. Claude Code reads `AGENTS.md` when there's no `CLAUDE.md`; if you want both, put `@AGENTS.md` at the top of `CLAUDE.md` to import it.
- Next.js 16.3+ writes a managed block into `AGENTS.md` pointing agents at the version-matched docs in `node_modules/next/dist/docs/`, because agents' training data often predates your Next.js version.

To share one file across tools, keep the content in `AGENTS.md` and import it from `CLAUDE.md`:

```md
<!-- CLAUDE.md (example) -->
@AGENTS.md

## Claude Code only
- Use the `reviewer` subagent before opening a PR.
```

### A good AGENTS.md (example)

```md
# Commands
- Install: pnpm install
- Typecheck: pnpm tsc --noEmit
- Lint: pnpm lint
- Run one test file: pnpm vitest run path/to/file.test.ts

# Conventions
- Server data: TanStack Query hooks in src/features/*/api. Don't fetch in useEffect.
- Errors: use AppError from src/lib/errors.ts. Never throw raw strings.
- src/legacy/ is still live but don't copy its patterns into new code.

# Gotchas
- Integration tests need DATABASE_URL, see .env.example.
- The orders API returns amounts in paise, not rupees.
```

### The test for every line
1. Could the agent find this by reading the code?
2. Would it actually go and look?

If both are yes, delete the line.

### Keep it short
Claude Code's docs recommend staying under about 200 lines per file; long files reduce how reliably instructions are followed. Instructions that matter for only part of the codebase go into scoped rules, and long procedures go into skills.

| Put in | Keep out |
|---|---|
| Build, test, lint commands | Folder-by-folder architecture tour |
| Team decisions not visible in code | "Write clean, maintainable code" |
| Misleading code to avoid copying | Secrets, tokens, internal URLs with credentials |
| Repeated corrections | Long step-by-step procedures (use a skill) |
| Domain gotchas | Absolute rules (use lint, hooks, permissions) |

## Follow-ups
- **Who maintains it?** — The team, through normal PRs. Treat it like code: review changes, delete stale lines, and fix contradictions, since agents may pick one of two conflicting instructions arbitrarily.
- **Can I generate one?** — Claude Code's `/init` drafts one from the codebase; most of the work after that is deleting lines.
- **Is it guaranteed to be followed?** — No. It's context, not enforcement. The model usually follows it but can decide otherwise.

## Common Mistakes
- Turning it into a 1,000-line wiki. Adherence drops as length grows.
- Shouting with IMPORTANT and ALL CAPS instead of moving the rule into a tool that enforces it.
- Keeping two diverging copies (`AGENTS.md` and `CLAUDE.md`) instead of importing one from the other.

## Tips
- The memorable framing: "It's a README for the agent. Only write what it can't read from the code."
- Show you know the limit: "Instructions are guidance. If something must never happen, I enforce it with a hook or lint rule."
