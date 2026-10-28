---
title: "Instructions vs hooks: how do you make an agent behaviour a guarantee?"
level: hard
type: concept
tags: [hooks, guardrails, determinism, pretooluse, posttooluse, formatting, permissions]
related: [ai-engineering/deterministic-guardrails, ai-engineering/agents-md-claude-md, ai-engineering/permissions-and-sandboxing]
---

## Question
You've told the agent in `AGENTS.md` to "always run the formatter" and "never edit `.env` files", yet it sometimes doesn't. What are hooks, how do they differ from instructions, and how would you use them?

## Clues
- An instruction is a request the model may follow; a hook is code the harness runs.
- Hooks fire on lifecycle events such as before or after a tool call.
- Use hooks for things that must always happen or never happen.

## Interview Answer
Instructions in `AGENTS.md` or `CLAUDE.md` are advisory text in the model's context, so they are followed most of the time but not guaranteed, especially late in a long session. Hooks are shell commands (or scripts) that the agent harness executes automatically on lifecycle events, independent of what the model decides: for example before a tool runs (`PreToolUse`), after it finishes (`PostToolUse`), when the user submits a prompt, or when the agent is about to stop. Because they are deterministic code, they are the right place for guarantees: auto-format and lint after every file edit, block writes to protected paths such as `.env` or lockfiles, block dangerous commands, run typecheck or tests before the agent can declare it is finished, or inject context. A hook receives event details (tool name, inputs) as JSON on stdin and can allow, block with feedback to the model (in Claude Code an exit code of 2 blocks and returns stderr to the agent), or add context. My rule: if a mistake is annoying, write an instruction; if it is costly or must never happen, enforce it with a hook, permission rule, or CI check.

## Explanation
### Advisory vs enforced

| Mechanism | Who enforces | Reliability | Good for |
|---|---|---|---|
| Instruction (`AGENTS.md`) | the model | high but not absolute | conventions, preferences, context |
| Hook | the harness runs your script | deterministic | formatting, blocking paths/commands, checks |
| Permission rules | the harness | deterministic | allow/deny tools and commands |
| Git hooks / CI | git / the pipeline | deterministic | final gate for everyone, human or agent |

### Typical events (Claude Code)
- `PreToolUse`: runs before a tool call; can block it.
- `PostToolUse`: runs after a tool call succeeds; can give the agent feedback.
- `UserPromptSubmit`: runs when a prompt is submitted; can add context.
- `Stop`: runs when the agent finishes responding; can force it to continue.
- `SessionStart`: runs at session start/resume; can set up the environment.
Hooks are configured in `settings.json` with a matcher (which tools) and a command. Check the current docs for the exact event names and options, as they evolve.

### Example: format after edits
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "npx prettier --write \"$(jq -r '.tool_input.file_path')\"" }]
      }
    ]
  }
}
```
The hook reads the event JSON from stdin (hence `jq`) and formats the file the agent just touched, so formatting never depends on the model remembering.

### Example: protect files
```bash
#!/usr/bin/env bash
# .claude/hooks/protect-env.sh — runs on PreToolUse for Edit|Write
path=$(jq -r '.tool_input.file_path // ""')
case "$path" in
  *.env|*.env.*|*pnpm-lock.yaml) echo "Blocked: $path is protected. Ask the user instead." >&2; exit 2 ;;
esac
exit 0
```
Exit code 2 blocks the call and sends the message back to the model so it can adjust. Other non-zero codes are non-blocking errors.

### Example: don't stop until checks pass
A `Stop` hook can run `tsc --noEmit` and tests; if they fail it returns a blocking result with the output so the agent keeps working instead of declaring victory. Guard against infinite loops (check the "already continuing from a stop hook" flag in the event input).

### Design guidance
- Keep hooks **fast** (they run often) and **quiet** (output goes to the model or log).
- Make them **idempotent** and safe to run repeatedly.
- Commit them with the repo (`.claude/settings.json`, `.claude/hooks/`) so the team shares them; use local settings for personal ones.
- Review hook scripts like any code: they run with your permissions.
- Don't rely on hooks alone: also enforce in git hooks/CI because humans and other tools bypass the agent harness.
- Prefer permission rules for simple allow/deny and hooks for logic.
- In this repository the guide says no Husky or tests by design; hooks configured for the agent are a separate, agent-side concern.

## Follow-ups
- **Hooks vs git pre-commit hooks?** — Agent hooks run during the agent's work loop and give it immediate feedback; git hooks run when committing and cover all contributors.
- **Can a hook be a security boundary?** — It reduces risk but should be combined with permissions and sandboxing, since a pattern-matching hook can be bypassed by unexpected command forms.

## Common Mistakes
- Relying on a prompt line for something that must never happen.
- Slow hooks that make every edit wait.
- Hooks that print noisy output into the context.

## Tips
- Use the phrase "advisory vs deterministic" and give one concrete hook example.
