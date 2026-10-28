---
title: "Agent permissions and sandboxing: how do you let an agent run commands safely?"
level: hard
type: concept
tags: [permissions, sandbox, allowlist, auto-approve, secrets, blast-radius, containers]
related: [ai-engineering/hooks-for-guarantees, ai-engineering/mcp-servers-risks, ai-engineering/ai-security-risks]
---

## Question
A coding agent can run shell commands, edit files and access the network. How do you balance productivity (fewer approval prompts) against safety? What controls would you set up?

## Clues
- Every approval prompt costs attention, and people eventually click through them.
- Limit what the agent *can* do rather than relying on what it *should* do.
- Think in terms of blast radius: files, credentials, network, and production systems.

## Interview Answer
I combine three layers. First, **permission rules**: allowlist read-only and routine commands (`git status`, test, typecheck, lint, build), require approval for anything that writes outside the project, installs dependencies, or touches git history, and deny the dangerous ones (force push, `rm -rf` outside the workspace, reading secret files). This removes noisy prompts for safe actions so the remaining prompts are meaningful. Second, **isolation**: run the agent in a sandbox such as a container, dev container, VM or disposable cloud environment, with a restricted filesystem, limited network egress, and no production credentials, so that even a mistake or a prompt-injection attack has a small blast radius. Third, **credentials hygiene**: give the agent least-privilege, short-lived tokens, keep secrets out of the working directory and environment where possible, and require human approval for anything that deploys, migrates a production database, or spends money. Auto-approve or "skip permissions" modes are acceptable only inside a disposable sandbox with no sensitive access. And I back this with deterministic checks (hooks, CI, branch protection) because permission prompts are a user-interface safeguard, not a security boundary on their own.

## Explanation
### Threats to design against
- **Mistakes**: deleting the wrong directory, force-pushing, running a destructive migration.
- **Prompt injection**: instructions hidden in a web page, issue, README, dependency or tool result that trick the agent into leaking data or running commands.
- **Over-broad credentials**: a token in the environment that can reach production.
- **Supply chain**: the agent installing an unvetted package that runs install scripts.
- **Data exfiltration**: sending code or secrets to an external URL via curl, a package, or a tool.

### Layer 1: permission rules
Typical tiers:
- **Allow** (no prompt): read files in the project, `git status/diff/log`, package scripts for test/lint/typecheck/build, formatter.
- **Ask**: `npm install`, `git commit/push`, network requests, edits outside the repo, running unfamiliar scripts.
- **Deny**: reading `.env*`, `~/.ssh`, cloud credentials; `git push --force`; `rm -rf` on broad paths; `curl | sh`; production CLIs.

Configure in the tool's settings (for Claude Code, `permissions` with `allow`, `ask`, `deny` in `settings.json`) and commit the shared parts. Keep allow rules specific: a prefix pattern like a wildcard on `npm run` also allows any script a malicious `package.json` defines.

### Layer 2: isolation
| Option | Isolation | Notes |
|---|---|---|
| Your laptop, default prompts | low | all your files and credentials are reachable |
| Dev container / Docker | medium | mount only the project; no host credentials |
| Disposable VM or cloud sandbox | high | fresh environment per task; egress rules; destroyed afterwards |
| OS-level sandbox features | medium–high | restrict filesystem and network for shell commands |

Network egress allowlists (package registry, docs, git host) reduce exfiltration risk. Cloud agent environments (like the one this session runs in) are ephemeral by design.

### Layer 3: credentials and blast radius
- Dedicated bot/least-privilege accounts, read-only database replicas for investigation.
- Short-lived tokens, not personal long-lived keys.
- Never place production secrets in `.env` files inside the workspace.
- Protected branches and required reviews: the agent can open a PR but not merge to main or deploy.
- Human approval gates for deploys, data migrations, billing and messaging users.

### Working habits
- Review what is being approved, especially commands with pipes or `sh -c`.
- Use plan mode for risky or unclear work before granting write access.
- Treat untrusted content (web pages, third-party issues, scraped docs) as data, not instructions.
- Audit the allowlist periodically and remove rules that are too broad; tools exist to suggest allowlist entries from past sessions.
- Log and review what agents did (transcripts, PR diffs).

### Why not just auto-approve everything?
"Approval fatigue" is real, but removing all checks without isolation turns one bad suggestion or injected instruction into a real incident. Reduce fatigue with good allowlists and sandboxes, not by deleting the safety net.

## Follow-ups
- **Is a permission prompt a security boundary?** — No; it is a human checkpoint. Real boundaries are OS/container isolation, network policy and credential scope.
- **How do you handle agents needing the network?** — Egress allowlists, a package mirror/proxy, and review of any new external hosts.

## Common Mistakes
- Allow rules so broad they permit arbitrary code execution.
- Running with skipped permissions on a machine holding real credentials.
- Giving the agent production access "just for debugging".

## Tips
- Describe the three layers and finish with "blast radius".
