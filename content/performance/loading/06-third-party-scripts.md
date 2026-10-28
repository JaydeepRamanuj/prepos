---
title: "Taming third-party scripts: audit, defer, isolate and measure"
level: medium
type: scenario
tags: [third-party, tag-manager, analytics, defer, facade, partytown, consent]
related: [nextjs/next-script-third-party, performance/inp-fixes, performance/core-web-vitals-overview]
---

## Question
Marketing keeps adding scripts through a tag manager (analytics, A/B testing, chat widget, heatmaps), and your INP and LCP regressed. How do you audit, quantify and reduce the impact without breaking the business needs?

## Interview Answer
I first inventory everything that loads (DevTools Network grouped by domain, WebPageTest request map, tag manager contents) and measure each script's cost in main-thread time, bytes and blocking, using Lighthouse's third-party summary, the Performance panel with domain grouping, and Long Animation Frames attribution in RUM. Then I classify by value: essential (payments, consent), useful (analytics), optional (heatmaps, chat). Reduction tactics: remove dead tags and duplicates; load with `async`/`defer`, after consent and after the page's critical interactions (`requestIdleCallback`, after `load`, or on first interaction); load chat and video widgets as facades that fetch the real script on click; self-host static scripts where licensing allows; use `preconnect` for the few critical origins; isolate heavy scripts in a Web Worker (Partytown) when compatible; and set performance budgets and a governance process (review before adding a tag). I verify with before/after field metrics.

## Explanation
### 1. Find and quantify

- **Network panel** → group by domain; filter "3rd-party".
- **Lighthouse** → "Reduce the impact of third-party code", "Minimize main-thread work", blocking time per entity.
- **Chrome DevTools Performance** → bottom-up grouped by "Domain"/"Entity"; look at long tasks with third-party stack frames.
- **RUM**: Long Animation Frames (LoAF) API lists `scripts` with `sourceURL`; attribute INP and long tasks to third parties.
- **WebPageTest**: "Block" third-party domains to measure the delta (SPOF testing too).

### 2. Remove and reduce
- Remove tags with no owner or consumer; consolidate overlapping analytics.
- Server-side tagging or first-party endpoints to cut browser work.
- Limit tag manager triggers: fire by page type, not "All Pages".
- Reduce frequency of beacons and polling.

### 3. Load smarter

```html
<!-- Non-critical, independent -->
<script src="https://analytics.example/a.js" async></script>

<!-- After load / idle -->
<script>
  window.addEventListener("load", () => {
    (window.requestIdleCallback || setTimeout)(() => {
      const s = document.createElement("script");
      s.src = "https://widget.example/chat.js";
      document.head.appendChild(s);
    });
  });
</script>
```

- **Consent gating**: don't load advertising/analytics until consent where required (also a legal issue).
- **Facades**: show a static placeholder (e.g. YouTube thumbnail, chat bubble) and load the real embed on interaction; libraries: `lite-youtube-embed`; `loading="lazy"` for iframes.
- **Sandboxed iframes** for ads/widgets to isolate their layout and scripts (`sandbox`, `loading="lazy"`).
- **Web Workers**: Partytown moves scripts off the main thread (needs proxying DOM access; not all scripts work).
- `preconnect` for the one or two origins that must be fast.

### 4. Protect the experience
- **Reserve space** for ads/widgets to avoid CLS.
- **Timeouts and fallbacks**: don't block UI on tag manager (A/B testing anti-flicker snippets that hide the page are a classic LCP killer; prefer server-side experiments).
- **CSP** limits what tags can load/run; Subresource Integrity for static third-party files.
- **Error isolation**: wrap callbacks; third-party failures shouldn't break the app.

### 5. Governance
- Performance budget per page: max third-party blocking time, max bytes.
- Approval checklist for new scripts: owner, purpose, load strategy, privacy review, performance test.
- Periodic audits (quarterly).
- Monitor vendors' changes (they update scripts without deploying your app).

### Example outcome

| Change | Effect |
|---|---|
| Removed 6 unused tags | −180 KB, −400 ms blocking |
| Chat widget as click-to-load facade | −250 ms TBT, INP −60 ms |
| Heatmap loaded after idle | LCP unaffected |
| Server-side experiments instead of anti-flicker | LCP −600 ms |

### In frameworks
Next.js `next/script` with `afterInteractive`/`lazyOnload`/`worker` strategies and `@next/third-parties` wrappers; React 19 `<script async>` hoisting and dedupe.

## Follow-ups
- **Does `async` make scripts harmless?** — It avoids blocking HTML parsing, but execution still blocks the main thread and can hurt INP.
- **How do you handle a tag manager?** — Treat it as an app with its own review process and budgets; limit who can publish.

## Common Mistakes
- Letting anyone add tags without review.
- Loading everything on every page.
- Anti-flicker snippets that hide the page.

## Tips
- "Inventory, measure, remove, defer, isolate, govern."
