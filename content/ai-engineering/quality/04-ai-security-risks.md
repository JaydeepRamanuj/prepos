---
title: "Security risks of AI-generated code and agent workflows"
level: hard
type: concept
tags: [security, ai-code, prompt-injection, secrets, dependencies, review, owasp]
related: [ai-engineering/reviewing-ai-code, ai-engineering/permissions-and-sandboxing, browser-security/supply-chain-security]
---

## Question
What security risks come from using AI coding agents, both in the code they produce and in the way they operate? What practices reduce the risk?

## Clues
- Two separate surfaces: insecure output, and the agent as an actor with access.
- Models reproduce common patterns, including insecure ones.
- Untrusted text can steer an agent.

## Interview Answer
There are two categories. **Insecure output**: models generate plausible code that often follows common but unsafe patterns, such as missing authorisation checks, trusting client-supplied ids or roles (IDOR, mass assignment), string-built SQL, unsanitised HTML rendering, weak cryptography or hard-coded secrets, permissive CORS or cookie flags, verbose error messages, and dependencies that are outdated, unnecessary, or even non-existent names that attackers register ("slopsquatting"). **The agent as an actor**: it can read files, run commands and use the network, so prompt injection through issues, web pages, READMEs or tool results can make it leak secrets or run harmful commands, and over-broad credentials or auto-approved permissions widen the blast radius. Controls: review for the security checklist rather than only functionality; run SAST, secret scanning and dependency audits in CI; verify any new package; keep secrets out of the workspace and prompts; sandbox the agent with least-privilege, short-lived credentials and restricted network; require approval for risky actions; treat all external content as untrusted data; and keep humans accountable for what is merged.

## Explanation
### Risks in generated code

| Risk | Typical AI mistake | Check |
|---|---|---|
| Broken access control | fetches by id without ownership check; trusts `isAdmin` from the client | every server entry point authenticates and authorises |
| Injection | concatenated SQL/shell; unsanitised HTML via `dangerouslySetInnerHTML` | parameterised queries, escaping, sanitisation |
| Secrets | API keys in source, `NEXT_PUBLIC_` secrets, `.env` committed | secret scanning, review of env usage |
| Weak auth | homemade JWT handling, no expiry, tokens in `localStorage` | use vetted libraries; cookie flags |
| Unsafe defaults | `cors({ origin: "*" })` with credentials, disabled TLS checks, debug on | configuration review |
| Input validation | trusting request bodies, no limits | schema validation (Zod), size limits |
| Info leakage | stack traces, PII in logs | error handling and logging review |
| Dependency risk | outdated versions, hallucinated or typosquatted packages | confirm the package exists, is maintained, lockfile review |
| Insecure crypto | MD5/SHA1 for passwords, ECB mode, `Math.random` for tokens | use bcrypt/argon2, platform crypto |
| Server Action exposure | action trusts arguments, no auth | re-authorise inside each action |

Studies and experience show that AI-assisted code can contain vulnerabilities at rates comparable to or higher than human code when unreviewed, and developers tend to over-trust it, so verification matters.

### Risks in how agents operate
- **Prompt injection** (direct from the user, or indirect from content the agent reads): can instruct the agent to exfiltrate `.env`, install a malicious package, or modify CI.
- **Excessive permissions**: shell access plus network plus real credentials.
- **Data exposure**: sending proprietary code or secrets to a model provider or MCP server; check data-handling and retention terms, and use enterprise plans where required.
- **Supply chain**: agent installs packages or runs scripts without scrutiny; generated CI config pulling unpinned actions.
- **Tool/MCP trust**: third-party servers with broad access.
- **Social engineering of the agent**: malicious issue or PR text crafted for AI readers.

### Practices that work
1. **Security in the prompt and plan** (e.g. "validate input with Zod; scope queries by user"), but never as the only control.
2. **Deterministic scanning**: ESLint security rules, Semgrep/CodeQL, secret scanners (gitleaks, GitHub secret scanning with push protection), `npm audit`/Dependabot.
3. **Dependency discipline**: verify new packages (exists, maintained, expected owner), pin versions, review lockfile diffs, restrict install scripts.
4. **Review with a checklist** for authN/authZ, input handling, output encoding, secrets, logging, and dependency changes (an agent-based security review can help as a first pass).
5. **Least privilege and isolation** for the agent: sandbox, scoped tokens, no production access, egress limits, approvals for destructive actions.
6. **Treat external text as data**: do not let the agent follow instructions found in issues, web pages or tool output without human judgement; don't combine private data access, untrusted input and an outbound channel in one session.
7. **Protect the pipeline**: branch protection, required reviews, no auto-merge of agent PRs for sensitive areas, signed commits where required.
8. **Incident readiness**: know how to rotate keys quickly if a secret reaches a prompt or repo.

### Example: spotting it in review
```ts
// AI-generated route handler
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.project.delete({ where: { id } });      // ❌ no session check, no ownership check
  return new Response(null, { status: 204 });
}
```
Fix: authenticate, load the project scoped to the user (or check role), then delete; write a test that user B cannot delete user A's project.

## Follow-ups
- **What is slopsquatting?** — Attackers register package names that models commonly hallucinate, so installing a suggested-but-nonexistent dependency installs malware. Always verify packages.
- **Should secrets ever be in prompts?** — No; use environment-scoped access with least privilege, and rotate if exposed.

## Common Mistakes
- Assuming generated code is secure because it "looks standard".
- Giving the agent production credentials.
- Skipping dependency checks because the agent chose the package.

## Tips
- Split the answer into "what it writes" and "what it can do", with controls for each.
