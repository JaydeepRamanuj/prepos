---
title: "You spot a security issue in a teammate's PR (and it may already be in production)"
level: medium
type: scenario
tags: [security, code-review, communication, incident, responsible-disclosure, secrets]
related: [scenarios/production-errors-cannot-reproduce, browser-security/csp-xss-basics, ai-engineering/ai-security-risks]
---

## Question
While reviewing a teammate's PR you notice a `dangerouslySetInnerHTML` rendering unsanitised user comments, and you realise a similar pattern was merged last month. How do you handle it technically and interpersonally?

## Interview Answer
I separate the immediate fix, the production risk and the team learning. On the PR I leave a clear, specific, blameless comment explaining the risk (stored XSS: an attacker could run script in other users' sessions), a concrete fix (sanitise with an allowlist sanitiser such as DOMPurify or render as text/markdown with a safe pipeline, and add a CSP as defence in depth) and block the merge. For the previously merged instance I verify it quickly (is it reachable, who can write the content, does it already contain malicious data?), and if it is exploitable I escalate privately and promptly to the security owner or on-call and treat it as an incident: mitigate first (feature flag it off, sanitise on render, deploy a hotfix), then investigate whether it was exploited using logs and data scans, rotate any exposed secrets, and notify per policy. I talk to my teammate directly and kindly, framing it as a system gap rather than a personal failure, and then fix the system: a lint rule or code-review checklist, a safe shared component, security training, and tests for the pattern.

## Explanation
### Triage
1. **Confirm** by reading the code path: where does the data come from, who controls it, where is it rendered, what is the session/privilege context?
2. **Assess severity**: stored XSS affecting all users who view the content is high; reflected XSS needing victim interaction is medium; self-XSS is low.
3. **Check exposure**: is it deployed? Which environments? Is the data already poisoned? Search the database/logs for `<script`, `onerror=`, `javascript:` in the stored fields.
4. **Decide the channel**: use the team's security process (private channel, ticket), not a public PR thread, for issues already in production.

### Fix examples
```tsx
// ❌
<div dangerouslySetInnerHTML={{ __html: comment.body }} />

// ✅ plain text (React escapes it)
<p>{comment.body}</p>

// ✅ if rich text is required: sanitise with an allowlist (ideally on write and on render)
import DOMPurify from "isomorphic-dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.body, { USE_PROFILES: { html: true } }) }} />
```
Add a Content Security Policy with nonces, and mark session cookies `HttpOnly`, so that an escape has limited impact.

### Communicating the review comment
Good:
> This renders `comment.body` as HTML. Since users can submit that field, a malicious comment like `<img src=x onerror=...>` would execute in everyone's session (stored XSS). Could we render it as text, or sanitise with DOMPurify? Happy to pair on it. I'll also check whether we have similar spots.

Avoid shaming, absolutes about intent, or public blame. Explain *why*, show the fix, offer help.

### Handling the already-merged code
- Don't wait for the PR to finish: file a ticket, ping security/on-call, and patch.
- Mitigation options: feature flag off, server-side sanitisation of output, temporary WAF rule, CSP report-only then enforce.
- Investigation: audit logs for suspicious payloads, check if admin sessions viewed content, review access logs.
- Remediation: invalidate sessions or rotate secrets if compromise is plausible; notify users or regulators if policy and law require.
- Post-incident review: blameless timeline, root cause (no sanitisation standard), detection gap (no review checklist), actions with owners.

### Preventing recurrence
- Shared `SafeHtml` component that always sanitises; lint rule (`react/no-danger`) with an allowlisted wrapper.
- Review checklist for auth, input handling, output encoding, secrets, dependencies.
- Automated scanners (CodeQL, Semgrep), secret scanning, dependency audit.
- Security training and "pattern of the month" in team meetings.
- Threat modelling for features that accept user content.

### Interpersonal considerations
Assume good intent, focus on code, acknowledge that these bugs are common (including in AI-generated code), and share what you learned. If the same issue repeats after feedback, raise it with the lead as a process gap. If someone pressures you to merge anyway, escalate with a clear risk statement; you shouldn't approve code you believe is exploitable.

## Follow-ups
- **What if the author disagrees that it's a risk?** — Provide a proof of concept in a safe environment, link authoritative guidance (OWASP), and involve the security owner for a decision.
- **Do you always escalate?** — Yes for exploitable issues in production; for theoretical or low-risk ones, a PR comment and a follow-up ticket may suffice.

## Common Mistakes
- Posting exploit details publicly.
- Merging "and fixing later".
- Blaming the person rather than improving the process.

## Tips
- Structure your answer: stop the bleeding, assess, fix, communicate kindly, prevent.
