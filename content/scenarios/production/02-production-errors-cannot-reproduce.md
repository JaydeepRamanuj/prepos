---
title: "Errors appear in production monitoring but nobody can reproduce them"
level: hard
type: scenario
tags: [debugging, sentry, source-maps, observability, session-replay, error-boundaries, breadcrumbs]
related: [scenarios/app-slow-after-release, react/error-boundaries, scenarios/security-issue-in-teammate-pr]
---

## Question
Sentry shows "Cannot read properties of undefined (reading 'id')" hundreds of times a day, from a checkout component, but nobody on the team can trigger it. How do you debug it, and how do you improve the system so such bugs are easier to catch next time?

## Clues
- The error report is evidence: stack trace, breadcrumbs, user agent, release, URL, and frequency.
- The cause is often environmental: data shape, timing, browser, extension, network.
- Observability must exist before the bug does.

## Interview Answer
I treat the report as data to mine. First, confirm the stack trace is readable (source maps uploaded for that release) and see the grouping: how many users, which browsers/devices/versions, which routes, and when it started relative to deploys or flags. Then I read breadcrumbs (clicks, navigation, network calls and console logs before the error) and, if available, session replay to see the actual user path. Common root causes for "works on my machine" bugs are: data that is `null`/missing for certain accounts (legacy records, partial API responses, optional fields), race conditions and slow networks (a component renders before data arrives, double-clicks, out-of-order responses), browser/device differences (older Safari lacking an API, extensions modifying the DOM, in-app browsers), stale cached bundles or version skew after deploys, and locale or timezone effects. I form hypotheses, reproduce by recreating the data shape and conditions (throttling, specific user account/data, browser emulation) and write a failing test, fix the underlying assumption (validate API data, handle loading and empty states, guard optional fields), and ship it behind observability: add context to the error (user segment, request id, state snapshot), error boundaries that degrade gracefully, and alerts on regressions.

## Explanation
### What to extract from the error
- **Stack trace** (with source maps): exact line and component.
- **Release/environment**: tied to a specific deploy? Version skew (users with old JS calling a new API)?
- **Browser/OS/device**: filter by tags; a single browser version often explains it.
- **URL/route and user segment**: plan, role, country, feature flags.
- **Frequency and unique users**: 500 events from 3 users (a retry loop) differ from 500 users.
- **Breadcrumbs**: last clicks, route changes, fetch calls with status codes.
- **Request IDs** to join with server logs for the same session.

### Hypothesis checklist for `reading 'id' of undefined`

| Hypothesis | How to test |
|---|---|
| API returns `null`/missing relation for some records | find affected user ids from events; query their data; check the API response in logs |
| Race: component uses data before loaded | throttle network; check conditional rendering and loading state handling |
| Stale client after deploy | compare client release vs server release; look for old versions in tags |
| Browser-specific API/behaviour | reproduce in BrowserStack/emulator for the reported versions |
| Browser extension or in-app webview interference | check user agents and DOM-related errors; add error filtering |
| Double submit / repeated action | inspect breadcrumbs for duplicate clicks; guard in UI and idempotency server-side |
| Feature-flag combination | filter by flag values |
| Type lies | TypeScript says non-null, runtime data isn't; validate at boundaries with Zod |

### Reproduce deliberately
- Fetch the affected account's real (sanitised) data into staging, or craft the same shape in a unit test.
- Use DevTools throttling, offline/online toggles, and request blocking/overrides to simulate delays and malformed responses.
- Replay the session breadcrumbs step by step.
- Write a failing test first: `render(<Checkout order={{ ...order, shippingAddress: null }} />)` should not crash.

### Fix well
- Handle the missing case explicitly (`order.shippingAddress?.id`, empty or error UI) and decide what the product should do, not just silence the error.
- Validate API responses at the boundary and report schema mismatches with context.
- Add an **error boundary** around the checkout section with a recovery action ("Reload", "Contact support") so one component doesn't blank the page.
- Fix the data issue at source if it's a backend/data bug.
- Add a regression test.

### Make future bugs debuggable
- Upload source maps per release (kept private); tag errors with release, route, user plan, flags, and request ids.
- Breadcrumbs and session replay (with PII masking).
- Structured client logging for key events; correlate with server logs through a trace id header.
- Dashboards and alerts on new error types, spikes after deploy, and error budget burn.
- Release health (crash-free sessions) and automatic deploy markers.
- Handle chunk-load errors after deploys (prompt to refresh).
- Privacy: scrub tokens and PII before sending.

### Communication
Provide an update on user impact (how many users, which flow), mitigation (workaround, rollback, flag off), and ETA. Close the loop by linking the fix PR to the issue.

## Follow-ups
- **What if there's no replay or breadcrumbs?** — Add targeted logging for the suspect state and ship it, then wait for the next occurrence; temporarily raise sampling on the affected route.
- **Should you ignore errors from browser extensions?** — Filter known noise with rules, but investigate patterns first since filters can hide real problems.

## Common Mistakes
- Closing the issue as "cannot reproduce".
- Fixing the symptom with `?.` everywhere without understanding the data.
- No source maps, so stacks point at minified code.

## Tips
- Say "turn the report into hypotheses, test each, then improve observability".
