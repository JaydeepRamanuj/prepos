---
title: "How do you debug an error that only happens in production?"
level: hard
type: scenario
tags: [source-maps, sentry, error-monitoring, production, logging]
related: [debugging/systematic-debugging-method, scenarios/production-errors-cannot-reproduce, debugging/works-locally-not-in-production]
---

## Question
Your error monitoring shows `TypeError: Cannot read properties of undefined (reading 'map')` at `main-4f2a.js:1:48213`, affecting 2% of users. It never happens locally. How do you turn this into a fix?

## Clues
- A minified line/column is useless until you map it back to your source. What file does that?
- 2% of users means something about those users differs. How do you find out what they have in common?
- What happened in the moments before the crash — which request, which click?

## Interview Answer
First I make the stack trace readable: production builds upload source maps to the error monitoring tool (Sentry or similar) at build time, so the frame becomes `ProductList.tsx:42` instead of `main.js:1:48213` — without serving the maps publicly. Then I look at the error's context: which release introduced it, browsers, routes, user segments, and the breadcrumbs — the clicks, navigations and API calls leading up to the crash. A `.map` on `undefined` with 2% of users usually means a data shape I didn't expect, so I check those requests' responses in logs and correlate by request ID. Once I know the condition I reproduce it locally with the same data or a mocked response, fix it at the boundary (validate the API response, handle the empty state), add a test, and watch the error rate drop for the new release.

## Explanation
### Step 1: Make the stack trace readable — source maps
A source map (`main-4f2a.js.map`) maps positions in the minified bundle back to original files, lines and names.

```txt
main-4f2a.js:1:48213  ──(source map)──▶  src/components/ProductList.tsx:42:18  (products.map)
```

Two ways to use them:

| Approach | Trade-off |
|---|---|
| Serve maps publicly (Next.js: `productionBrowserSourceMaps: true`) | Easy DevTools debugging, but exposes your source; increases build time and memory |
| **Generate maps, upload to the monitoring tool, don't serve them** | Readable stack traces in the dashboard, source stays private — the usual choice |

Monitoring SDKs provide build plugins that upload maps and tag them with a **release** (often the git SHA). Release tagging is what lets you say "this started in release `a1b2c3`".

### Step 2: Read the context, not just the message
A good error event includes:
- **Release, environment, browser/OS, URL** — does it cluster on Safari 17? on `/checkout`? on the new release?
- **Breadcrumbs** — the recent console logs, navigations, clicks and fetches before the error.
- **User/tenant ID** (no PII beyond what policy allows) — is it one customer's data?
- **Request ID / trace ID** — join the frontend event to backend logs.

Session replay, if your team uses it, shows exactly what the user did.

### Step 3: Form and test a hypothesis
For `products.map` on `undefined`, likely causes:
- The API returns `{ items: null }` or a different shape for some accounts (legacy data, a feature flag on the backend).
- A failed request is not handled, so the component renders with `data.products` undefined.
- A cached old API response (CDN, service worker) after a backend schema change.

Pull a failing request from the logs, replay its response locally (mock it, or *Copy as fetch* in DevTools), and the bug reproduces.

### Step 4: Fix at the boundary

```ts
import { z } from "zod";

const ProductsResponse = z.object({
  products: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
});

export async function getProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error(`products: ${res.status}`);
  return ProductsResponse.parse(await res.json()); // fails loudly with a useful message
}
```

Validating at the edge turns a vague crash deep in the UI into a clear error at the source — and a React error boundary keeps the rest of the page working.

### Step 5: Server-side errors in Next.js
For errors thrown during server rendering, the browser only receives a generic message plus a `digest`. Log server errors with the `onRequestError` export in `instrumentation.ts` (forward them to your provider), then search server logs by that digest. Client-side monitoring setup can live in `instrumentation-client.ts`, which runs before the app becomes interactive.

### Step 6: Verify and close
Ship the fix, filter the dashboard by the new release, and confirm the error count drops to zero. Mark the issue "resolved in release X" so a regression reopens it automatically.

## Follow-ups
- **Why not just serve source maps publicly?** — It exposes your original source and comments; the private upload gives the same debugging value. Some teams accept public maps for open-source or non-sensitive apps.
- **How do you avoid alert noise?** — Group by fingerprint, ignore known third-party/extension errors, set alerts on new issues and on spikes rather than every event.
- **What about errors with no stack trace, like "Script error."?** — That is a cross-origin script error being hidden; serve the script with CORS headers and add `crossorigin="anonymous"` to the script tag to see details.

## Common Mistakes
- Debugging the minified stack trace by hand instead of fixing the source map pipeline.
- Uploading maps without a release tag, so you can't tie errors to a deploy.
- Wrapping the crash in `products?.map` and moving on — the UI no longer crashes, but you never learned why data was missing.

## Tips
- Structure the answer: readable trace → context → hypothesis → reproduce → fix at the boundary → verify by release.
- Saying "upload source maps privately, don't serve them" signals real production experience.
