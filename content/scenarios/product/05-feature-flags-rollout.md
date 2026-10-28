---
title: "Roll out a risky redesign safely with feature flags and gradual release"
level: medium
type: scenario
tags: [feature-flags, rollout, experimentation, kill-switch, canary, tech-debt]
related: [scenarios/app-slow-after-release, ai-engineering/measuring-ai-impact]
---

## Question
You are replacing the checkout page with a redesigned version. A bug here costs revenue. How do you ship it gradually, observe its impact, and be able to undo it instantly?

## Interview Answer
I'd put the new checkout behind a **feature flag** and release it progressively: first to internal staff, then 1–5% of real users, then 25%, 50% and 100%, watching business and technical metrics at each stage with a kill switch that turns the flag off without a deploy. Assignment is sticky (hashing a stable user or session id so a user doesn't flip between versions mid-flow) and consistent between server and client to avoid hydration flicker. I define success and guardrail metrics beforehand (conversion rate, payment errors, page performance, support tickets), compare the cohorts, and only advance when they hold. Flags decouple deploy from release, so code ships dark and merges early, and I clean flags up afterwards to avoid permanent dead branches. For data-model changes I add backward-compatible migrations (expand, migrate, contract) so both versions work during the rollout.

## Explanation
### Release plan

| Stage | Audience | Check |
|---|---|---|
| 0 | tests, preview deploys | CI, e2e on both variants |
| 1 | internal users (flag by email/role) | dogfooding, bug bash |
| 2 | 1–5% of traffic | error rate, payment success, Web Vitals |
| 3 | 25% → 50% | conversion vs control, support volume |
| 4 | 100% | keep the old path for a few days as fallback |
| 5 | cleanup | delete old code and the flag |

### Implementation
```ts
// server: evaluate once per request, pass to the client to avoid flicker
const variant = await flags.evaluate("new-checkout", { userId, country, plan });   // sticky bucketing

export default async function CheckoutPage() {
  const useNew = await isEnabled("new-checkout");
  return useNew ? <NewCheckout /> : <LegacyCheckout />;
}
```
- Bucket by a hash of a stable id (`hash(userId + flagKey) % 100 < percentage`); don't use random per request.
- Evaluate on the server where possible (Server Components, `proxy.ts` rewrites) so the client receives the right HTML and there's no flash.
- Provide a typed flag client with safe defaults if the flag service is unreachable (usually the old path).
- Options: LaunchDarkly, Statsig, GrowthBook, Vercel Flags/Edge Config, Unleash, or a simple config table for small teams.

### Metrics and guardrails
- **Primary**: checkout conversion, revenue per session.
- **Guardrails**: payment failure rate, JS errors, latency, INP/LCP, refund/support rate.
- **Segment** by device and country; a win on desktop can hide a loss on mobile.
- Wait for enough sample size to avoid noisy decisions; define a stopping rule in advance.
- Monitor in real time with alerts that can auto-disable the flag.

### Risks and how to handle them
- **Inconsistent state across versions** (cart schema changes): keep schemas backward-compatible; migrate in phases.
- **Combinatorial explosion** of flags: limit simultaneous flags, document ownership and expiry dates.
- **Testing both paths**: e2e tests run against each variant; keep the old path working until cleanup.
- **Caching**: CDN/page caching must vary by flag (or the personalised part must be separate), otherwise users see the wrong variant.
- **Analytics attribution**: log the variant with every event.
- **Flag debt**: schedule removal; lint for flags past their expiry.
- **Security**: don't expose sensitive targeting rules to the client.
- **Operations flag vs release flag**: kill switches stay permanently; release flags are removed.

### Alternatives
Blue/green or canary deployments split traffic at the infrastructure level (good for backend changes) while feature flags target users and features; use both. Preview deployments let stakeholders test before any rollout.

## Follow-ups
- **A/B test or rollout?** — A rollout checks safety; an A/B test needs a randomised control and a pre-defined statistical analysis to prove improvement.
- **What if the flag service goes down?** — Use cached last-known values or safe defaults and avoid putting the flag service in the critical request path without fallback.

## Common Mistakes
- Releasing to 100% at once.
- Flipping users between versions mid-session.
- Leaving flags in the code forever.

## Tips
- Frame it as "decouple deploy from release; staged exposure; kill switch; cleanup".
