---
title: "Production console shows 'Hydration failed': find the cause in a real component"
level: hard
type: debugging
tags: [hydration, ssr, mismatch, locale, window, debugging]
related: [nextjs/hydration-how-it-works, react/use-id, react/use-sync-external-store, nextjs/third-party-and-browser-only-code]
---

## Question
After adding a promotional banner, production logs "Hydration failed because the server rendered text didn't match the client", and the page flickers. Here is the component. Find every source of mismatch and fix them without hiding warnings.

```tsx
"use client";
export function PromoBanner({ endsAt }: { endsAt: string }) {
  const [dismissed] = useState(() => localStorage.getItem("promo-dismissed") === "1");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const remainingMs = new Date(endsAt).getTime() - Date.now();

  if (dismissed) return null;

  return (
    <div>
      <p>Sale ends {new Date(endsAt).toLocaleString()}</p>
      <p>{isMobile ? "Tap to shop" : "Click to shop"}</p>
      <p>{Math.floor(remainingMs / 3600000)} hours left</p>
      <p><div>Free shipping</div></p>
    </div>
  );
}
```

## Clues
- Which values differ between the server render and the first client render?
- Which of them depend on the environment (browser storage, viewport, time zone, clock)?
- One mismatch is invalid HTML nesting.

## Interview Answer
There are five problems. `localStorage` in the state initialiser throws on the server and, where guarded, gives a different value on the client than the server rendered. `window.innerWidth` is undefined on the server and a number in the browser, so the text differs. `toLocaleString()` depends on the server's locale and time zone versus the user's. `Date.now()` is different on the server and client, so the hours-left number differs by the time hydration happens. And `<div>` inside `<p>` is invalid HTML, which the browser repairs before React compares it. The fix is to render a deterministic first pass that matches the server, then refine in an effect after mount: format dates with an explicit locale and time zone (or compute on the server and pass strings), read `localStorage` and viewport in `useEffect` (or `useSyncExternalStore` with a server snapshot), use CSS media queries for mobile/desktop copy, and correct the HTML. I'd avoid `suppressHydrationWarning` except for a single time text node.

## Explanation
### Diagnosis table

| Line | Why it mismatches | Fix |
|---|---|---|
| `localStorage` in `useState` initialiser | not available on the server; value differs on the client | read after mount in an effect |
| `window.innerWidth` | `undefined` on the server | CSS media queries or `useSyncExternalStore` with a server snapshot |
| `toLocaleString()` | server locale/time zone ≠ user's | pass a preformatted string, or explicit `Intl.DateTimeFormat("en-US", { timeZone: "UTC" })`, then localise on the client after mount |
| `Date.now()` | server time at render ≠ client time at hydrate | compute after mount, or tick in an effect |
| `<p><div>` | invalid nesting, browsers restructure the DOM | use `<div>` inside `<div>` or `<span>` inside `<p>` |

### Fixed version

```tsx
"use client";
import { useEffect, useState } from "react";

export function PromoBanner({ endsAt, endsAtLabel }: { endsAt: string; endsAtLabel: string }) {
  const [dismissed, setDismissed] = useState(false);          // same on server and first client render
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  const [localLabel, setLocalLabel] = useState(endsAtLabel);  // server-formatted (UTC) first

  useEffect(() => {
    setDismissed(localStorage.getItem("promo-dismissed") === "1");
    setLocalLabel(new Date(endsAt).toLocaleString());
    const tick = () => setHoursLeft(Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 3600000)));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (dismissed) return null;

  return (
    <div>
      <p>Sale ends {localLabel}</p>
      <p><span className="md:hidden">Tap to shop</span><span className="hidden md:inline">Click to shop</span></p>
      {hoursLeft !== null && <p>{hoursLeft} hours left</p>}
      <div>Free shipping</div>
    </div>
  );
}
```

The server computes `endsAtLabel` with a fixed locale and time zone, so the first client render matches. The effect then refines it for the user.

### Avoiding the flash for dismissed state
A flash occurs because a returning user briefly sees the banner. Options: store dismissal in a cookie and read it on the server (the banner is rendered conditionally in the Server Component, so HTML is correct), accept the tiny flash, or render the banner initially hidden and reveal after the check.

### With `useSyncExternalStore`

```tsx
const dismissed = useSyncExternalStore(
  (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
  () => localStorage.getItem("promo-dismissed") === "1",
  () => false                                   // server snapshot
);
```

### Process for real-world debugging
1. Read the React 19 diff in the console: it shows the differing text/attributes.
2. Compare View Source (server HTML) with the DOM after load.
3. Search for environment-dependent expressions: `window`, `document`, `localStorage`, `Date`, `Math.random`, `Intl`, `navigator`.
4. Check HTML validity (nesting).
5. Disable browser extensions that modify the DOM.
6. Reproduce with a production build.

### What not to do
- Don't wrap with `typeof window !== "undefined"` branches in render.
- Don't set `suppressHydrationWarning` on a container; it only applies to one element's immediate text/attributes and hides real bugs.
- Don't return `null` on the server for everything and render only on the client, which loses content for SEO and causes layout shift.

## Follow-ups
- **Will React recover from the mismatch?** — Yes, by client-rendering the affected Suspense boundary or root, at a performance cost and sometimes with flicker.
- **Why did it only show in production?** — Dev mode might render with different data or users test in one locale; time zone and locale differences appear in real traffic.

## Common Mistakes
- Hiding the warning instead of fixing the cause.
- Formatting dates with the default locale on the server.
- Forgetting invalid nesting.

## Tips
- Say "deterministic first render, refine after mount".
