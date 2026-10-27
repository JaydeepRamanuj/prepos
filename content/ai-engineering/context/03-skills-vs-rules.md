---
title: "What is an agent skill, and when is a skill better than a rule?"
level: hard
type: concept
tags: [skills, rules, context, claude-code]
related: [ai-engineering/agents-md-claude-md, ai-engineering/scoped-project-rules, ai-engineering/giving-agents-docs]
---

## Question
Your team keeps pasting the same 30-line checklist into chat whenever someone adds a new API endpoint: create the Zod schema, the route handler, the typed client function, the MSW mock and the tests. Someone suggests adding it to `AGENTS.md`; someone else suggests making it a skill. What is a skill, and which would you choose here?

## Clues
- Think about *when* each one is loaded into the agent's context, and what that costs on unrelated tasks.
- One of these is a fact or convention; the other is a procedure with steps.
- Some procedures have side effects. Should the agent be able to start them on its own?

## Interview Answer
A skill is a packaged procedure: a folder with a `SKILL.md` that has a name, a description and step-by-step instructions, optionally with templates or scripts next to it. The agent only sees the name and description up front and loads the full body when the task matches, or when I invoke it by name. A rule or `AGENTS.md` line is loaded in every session. So the split is: short facts and conventions that apply broadly go in rules; multi-step procedures that are needed occasionally go in skills. The endpoint checklist is a procedure needed only when adding an endpoint, so I'd make it a skill, with the example schema and test as supporting files. If a skill has side effects, like cutting a release, I make it user-invoked only so the agent can't start it on its own.

## Explanation
### How a skill is structured
In Claude Code, skills follow the open Agent Skills format and live in `.claude/skills/<name>/SKILL.md` (project, committed) or `~/.claude/skills/<name>/SKILL.md` (personal). The folder name becomes a slash command, so `.claude/skills/new-endpoint/` gives you `/new-endpoint`. Custom slash commands in `.claude/commands/` have been merged into skills and keep working.

```txt
.claude/skills/new-endpoint/
├── SKILL.md
├── schema.example.ts
└── route.test.example.ts
```

```md
---
name: new-endpoint
description: Adds a new REST endpoint end to end (Zod schema, route handler, typed client, MSW mock, tests). Use when the user asks to add or expose an API endpoint.
---
<!-- .claude/skills/new-endpoint/SKILL.md (example) -->
1. Define request and response schemas in src/api/schemas/<name>.ts,
   following schema.example.ts in this folder.
2. Create the route handler in app/api/<name>/route.ts. Validate the body
   with the schema; return errors via toErrorResponse() from src/lib/errors.ts.
3. Add a typed client function to src/api/client.ts using the same schema.
4. Add an MSW handler in src/mocks/handlers.ts.
5. Write tests modelled on route.test.example.ts. Run pnpm vitest run app/api/<name>.
6. Report the files changed and the test output.
```

The `description` matters most: it's what the agent reads to decide whether to load the skill, so say what it does *and* when to use it.

### Loading cost: the core trade-off

```txt
Session start context
  AGENTS.md / rules  ████████████  (always, on every task)
  skill metadata     █             (name + description only)
  skill body         ░░░░░░░░      (loaded only when used)
```

| | Rule / AGENTS.md | Skill |
|---|---|---|
| Best for | Facts, conventions, gotchas | Procedures, checklists, workflows |
| Loaded | Every session (or when paths match) | Description always; body on demand |
| Invoked | Implicitly | Automatically when relevant, or `/name` |
| Can bundle files/scripts | No | Yes |

### When the agent shouldn't start it
For skills with side effects (deploy, release, migrating data), Claude Code supports `disable-model-invocation: true` in the frontmatter, so it only runs when you type the command. Model-invoked skills are for safe, helpful procedures; anything you can't undo should be user-invoked.

### The counter-intuitive result about knowledge
Skills are good for workflows, but not necessarily for *reference knowledge* the agent needs on every task. Vercel's evaluations for Next.js found that always-available docs referenced from `AGENTS.md` beat skill-based retrieval, because the agent didn't always decide to load the skill. Next.js now ships framework knowledge as bundled docs and reserves skills for multi-step workflows like adopting Cache Components. The lesson: if the agent needs it constantly, make it always-available; if it's a procedure used sometimes, make it a skill.

### Cross-tool note
Cursor and other agents have their own versions of reusable commands and skills, and the Agent Skills format is adopted by several tools, but details differ. In an interview, explain the concept (on-demand procedure vs always-loaded convention) rather than one tool's flags.

## Follow-ups
- **How do you know a skill is actually being used?** — Test it: give a task that should trigger it and see whether it loads. If not, sharpen the description or invoke it explicitly.
- **Can a skill run in isolation?** — In Claude Code a skill can be set to run in a forked subagent context, which keeps a long procedure's output out of your main conversation.
- **Skill vs subagent?** — A skill is instructions the current agent follows; a subagent is a separate agent with its own context and tools that reports back.

## Common Mistakes
- Putting long procedures in `AGENTS.md`, where they cost context on every unrelated task.
- Vague descriptions ("API helper") so the agent never picks the skill up.
- Letting the agent auto-invoke skills that deploy, publish or delete things.

## Tips
- One-liner: "Rules are what's true about the codebase; skills are how we do a specific job."
- Mention the evaluation result about docs vs skills. It shows you make decisions from evidence, not hype.
