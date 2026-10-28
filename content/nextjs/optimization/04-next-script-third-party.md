---
title: "Third-party scripts in Next.js: next/script strategies and their impact on performance"
level: medium
type: concept
tags: [next-script, third-party, analytics, inp, strategy, partytown]
related: [nextjs/third-party-and-browser-only-code, performance/third-party-scripts, nextjs/csp-and-security-headers]
---

## Question
How do you load analytics, chat widgets and tag managers in a Next.js app? Explain the `strategy` options of `next/script`, the inline-script rules, and how to measure and limit their cost.

## Interview Answer
I load third-party code with `next/script`, which lets me control when it runs: `beforeInteractive` for critical scripts that must run before hydration (and only from the root layout), `afterInteractive` (the default) after hydration for analytics and tag managers, `lazyOnload` during browser idle time for low-priority widgets like chat, and `worker` (experimental) to move scripts off the main thread with Partytown. Inline scripts need an `id` so Next.js can track and dedupe them, and `onLoad`, `onReady` and `onError` callbacks run in Client Components. Third-party scripts commonly hurt INP and LCP, so I audit them, load only what's needed per route, defer non-essential ones, use Google's or Vercel's `@next/third-parties` wrappers for common embeds (GA, GTM, YouTube, Maps) which are optimised, and monitor field metrics after each addition. With a nonce-based CSP, the scripts need the nonce too.

## Explanation
### Strategies

| Strategy | When it loads | Use for |
|---|---|---|
| `beforeInteractive` | before Next.js hydrates; injected in HTML head (root layout only) | bot detection, consent managers, polyfills |
| `afterInteractive` (default) | after some hydration | analytics, tag managers |
| `lazyOnload` | idle time after load | chat widgets, social buttons |
| `worker` (experimental) | off the main thread via web worker | heavy analytics; compatibility varies |

```tsx
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date()); gtag('config', 'G-XXXX');`}
        </Script>
        <Script src="https://widget.example.com/chat.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
```

### Rules
- Place `<Script>` in a layout to load it once for all routes under that layout, or in a specific page to scope it. It loads only once even if rendered in several components.
- Inline scripts require an `id` attribute.
- Event handlers like `onLoad`/`onReady`/`onError` can't be used in Server Components; wrap the script in a Client Component.
- `beforeInteractive` is only allowed in the root layout (`app/layout`) and adds blocking cost; use rarely.
- To pass attributes like `nonce`, `crossOrigin`, add them as props; with a CSP, forward the nonce from the request header.

### Ready-made wrappers

```tsx
import { GoogleTagManager, GoogleAnalytics } from "@next/third-parties/google";
<GoogleTagManager gtmId="GTM-XXXX" />
```

`@next/third-parties` also provides optimised YouTube and Google Maps embeds that load lazily.

### Measuring cost
1. Chrome DevTools Performance: long tasks attributed to third-party domains.
2. Lighthouse "Reduce the impact of third-party code".
3. WebPageTest request map with blocking time per domain.
4. Field INP via RUM (`useReportWebVitals`), segmented before/after a script.
5. Bundle analyzer doesn't show externally loaded scripts; use network tools.

### Reducing impact
- Remove duplicate trackers; consolidate through a tag manager (itself a risk).
- Consent-gate scripts: load analytics only after consent.
- Load on interaction (click to open chat) or visibility.
- Server-side tagging or first-party proxying where appropriate.
- Facade pattern for heavy embeds (YouTube thumbnail until click).
- Use `worker` strategy only after testing; many scripts need DOM access and break.
- Set `preconnect` to critical third-party origins.

### Pitfalls
- Putting `<script>` tags manually in the layout (no load control or dedupe).
- Assuming `afterInteractive` is "free": it still executes on the main thread near hydration time.
- Forgetting CSP allowances (`script-src` and `connect-src`).

## Follow-ups
- **Does `next/script` work in the Pages Router?** — Yes, with `_app` or per page.
- **Why is `async` not enough?** — It avoids blocking parsing but the script still executes whenever it arrives, possibly during hydration.

## Common Mistakes
- Loading everything with `beforeInteractive`.
- Missing `id` on inline scripts.
- Not measuring after adding a script.

## Tips
- Tie each script to a strategy and a justification.
