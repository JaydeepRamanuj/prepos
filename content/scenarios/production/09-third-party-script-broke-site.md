---
title: "A third-party script (tag manager) breaks checkout in production. Respond and prevent it"
level: advanced
type: scenario
tags: [third-party-scripts, incident, tag-manager, csp, sri, monitoring, rollback, governance]
related: [browser-security/supply-chain-security, browser-security/csp-xss-basics, scenarios/app-slow-after-release]
---

## Question
Marketing edited the Google Tag Manager container at 4 pm. By 4:20 the checkout conversion rate drops 40% and errors spike, but no code was deployed. How do you respond during the incident, find the cause, and prevent a repeat?

## Clues
- Changes outside your deployment pipeline can still change production behaviour.
- Rapid mitigation (rollback/disable) comes before root cause analysis.
- Third-party code runs with the same privileges as yours.

## Interview Answer
During the incident I focus on restoring service: confirm the impact with metrics and error monitoring, notice there was no deploy, and look at what else changed, such as the tag manager container version history, feature flags, CDN or vendor updates. If the timing matches the container publish, I roll the container back to the previous version (or pause the newly published tags), which is typically a quick, low-risk action, and verify recovery through conversion, errors and a manual checkout test. Then I investigate: use error tracking, console logs and the network panel in a failing session to find the offending tag (for example a script that overrides a global, injects an overlay, blocks the main thread, throws on a missing element, or calls a failing endpoint that delays form submission), reproduce with the container preview mode, and document the root cause. Prevention: governance and guardrails for tags (publish permissions, approval workflow, staging environment and preview, change notifications to engineering), restricting scripts with CSP and loading non-essential tags only on non-critical pages (exclude checkout or load minimal tags), isolating or deferring them (`afterInteractive`/`lazyOnload`, web workers, sandboxed iframes), monitoring (synthetic checkout tests, JS error alerts, RUM) with alerts tied to tag changes, and a regular audit to remove unnecessary tags.

## Explanation
### Incident timeline
1. **Detect**: alerts on conversion drop, JS error rate, synthetic checkout failure.
2. **Declare** an incident, assign roles (lead, communications), start a channel, post a status note.
3. **Triage**: what changed? Deploys, flags, infra, **third-party changes** (GTM container publishes, vendor script updates, CDN, payment provider status). Correlate with change logs, vendor status pages and the version history in the tag manager.
4. **Mitigate**: roll back the container version / disable the new tag / flip a kill switch that disables tag manager on checkout. Don't wait for full root cause.
5. **Verify**: metrics recover; run a manual and automated checkout test; watch errors.
6. **Communicate**: stakeholders, support talking points; estimate revenue impact.
7. **Investigate** and write a blameless post-incident review.

### Finding the culprit
- Compare error samples: stack traces pointing at third-party domains or anonymous scripts (`Script error.` for cross-origin without CORS; use `crossorigin` and proper headers to get details).
- Open the failing page with the container's **preview/debug mode**, disable tags one at a time.
- Network tab: blocked requests, long-running tag calls, redirects, changed script URLs.
- Performance panel: long tasks introduced by tags (heavy DOM scanning, session replay).
- Typical failure modes: duplicate analytics libraries overwriting `window.dataLayer` or globals; a tag's custom HTML modifying DOM nodes React controls (breaking hydration or handlers); event listeners capturing clicks or form submits (`preventDefault` or blocking navigation); a CSS injection that hides the pay button; a consent script failing to load and blocking; cookie conflicts; adding latency to `submit` handlers (e.g. waiting for a tracking call).

### Prevention: governance
- **Access control**: limited publishers; require review for changes touching checkout pages; two-person approval for custom HTML/JS tags.
- **Environments**: staging workspace and preview before publish; automated tests (Playwright) running against the preview container.
- **Change management**: every publish posts to a channel with a diff; versions named with ticket links; scheduled change windows away from peak hours.
- **Tag hygiene**: inventory with owners and purpose; remove unused vendors; prefer first-party server-side tagging when possible.
- **Page scoping**: don't load marketing tags on critical flows (checkout, login); use the server-side or minimal configuration there.

### Prevention: technical controls
```tsx
// Next.js: load tags late, not on critical pages
<Script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX" strategy="lazyOnload" />
```
- **CSP**: restrict `script-src`, `connect-src` and `frame-src` to known domains; use a nonce + `strict-dynamic` knowing tag managers can load further scripts, so CSP limits blast radius but doesn't fully contain a compromised tag manager.
- **Isolation**: sandboxed iframes for untrusted widgets; run analytics off the main thread (Partytown) where compatible.
- **Defensive code**: don't let tracking calls block user actions; wrap tracking in try/catch, fire-and-forget (`navigator.sendBeacon`), and never `await` third-party calls in critical handlers.
- **Subresource Integrity** only works for static, versioned scripts; vendor-managed dynamic scripts (GTM) can't be pinned, which is why governance matters.
- **Kill switch**: a config flag that disables all third-party scripts without a deploy.
- **Monitoring**: synthetic checkout tests every few minutes in production, error alerts segmented by script origin, RUM and conversion alerts, deployment/change markers on dashboards including tag publishes.

### Post-incident review
Capture timeline, impact (orders lost), root cause (e.g. a custom HTML tag attached a click handler to `button[type=submit]`), detection gap (took 20 minutes), response gap, and actions with owners and deadlines (approval workflow, synthetic test, kill switch, tag audit). Share learnings with marketing as partners, not blame.

## Follow-ups
- **Why not just ban tag managers?** — Business teams need agility; guardrails (review, staging, scoping, monitoring) preserve it while reducing risk.
- **How does server-side tagging help?** — Moves vendor logic off the browser, reducing main-thread cost and the client attack surface, while giving you control over what data is sent.

## Common Mistakes
- Debugging code for hours when nothing was deployed.
- No kill switch for third-party scripts.
- Letting anyone publish changes to production tags.

## Tips
- Say "restore first, then investigate; third-party code is production code and needs change management".
