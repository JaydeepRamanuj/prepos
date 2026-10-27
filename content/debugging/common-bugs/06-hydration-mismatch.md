---
title: "Fix the hydration mismatch in this Next.js component"
level: hard
type: debugging
tags: [hydration, ssr, nextjs, client-components, dates]
related: [debugging/date-timezone-float-bugs, debugging/works-locally-not-in-production, debugging/event-listener-fires-twice]
---

## Question
This Client Component in a Next.js App Router page logs "Hydration failed because the server rendered text didn't match the client" for some users. Find every cause and fix them.

```tsx
"use client";

export function OrderSummary({ placedAt }: { placedAt: string }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const theme = typeof window !== "undefined" ? localStorage.getItem("theme") : "light";

  return (
    <p className={theme === "dark" ? "text-white" : "text-black"}>
      <div>Order #{Math.floor(Math.random() * 1000)}</div>
      Placed {new Date(placedAt).toLocaleString()}
      {isMobile ? <MobileActions /> : <DesktopActions />}
    </p>
  );
}
```

## Clues
- Client Components still render on the server. What must be true about the first client render compared to the server HTML?
- Which values here can differ between a Node server in a data centre and a browser in India?
- One problem has nothing to do with data — check the HTML nesting.

## Interview Answer
Hydration means React reuses the server HTML and expects the first client render to produce exactly the same output; anything that differs is a mismatch. This component has five causes: `typeof window` branches give different output on server and client for `isMobile` and `theme`; `Math.random()` gives a different number on each side; `toLocaleString()` depends on the runtime's locale and time zone, so a UTC server and an IST browser print different times; and a `<div>` inside a `<p>` is invalid HTML, so the browser's parser rewrites the DOM before React hydrates. The fixes: render the same thing on both sides first and switch to client-only values in an effect (or with CSS media queries for layout), take the order number as a prop, format the date with an explicit time zone or only after mount, and use a `<div>` wrapper.

## Explanation
### The rule
```txt
server render ──▶ HTML ──▶ browser shows it ──▶ client render #1 must equal HTML ──▶ attach handlers
                                                   ↑ differences = hydration error
```
After hydration, later renders can show whatever they like. So the pattern is: **same output for render #1, client-only values afterwards.**

### Cause → fix

| Cause | Why it differs | Fix |
|---|---|---|
| `typeof window` / `innerWidth` | Server has no window | CSS media queries, or set state in `useEffect` after mount |
| `localStorage` theme | Server can't read it | Store theme in a cookie and read it on the server, or set a class with an inline script before paint (what `next-themes` does) |
| `Math.random()`, `Date.now()` | Different each call | Generate on the server and pass as a prop; use `useId` for ids |
| `toLocaleString()` | Server locale/time zone ≠ user's | Pass `timeZone` (and locale) explicitly, or format on the client after mount |
| `<div>` inside `<p>` | Invalid nesting; the parser closes the `<p>` early | Use valid nesting |
| Browser extensions | Inject attributes into `<html>`/`<body>` | Not your bug; `suppressHydrationWarning` on `<html>` only if needed |

### Fixed component

```tsx
"use client";

import { useEffect, useState } from "react";

const formatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata", // same output on server and client
});

export function OrderSummary({ placedAt, orderNumber }: { placedAt: string; orderNumber: number }) {
  return (
    <div className="text-black dark:text-white">
      <div>Order #{orderNumber}</div>
      <p>Placed {formatter.format(new Date(placedAt))}</p>
      {/* layout differences via CSS, not JS branches */}
      <div className="md:hidden"><MobileActions /></div>
      <div className="hidden md:block"><DesktopActions /></div>
    </div>
  );
}
```

If the time must be in the **user's** time zone, you cannot know it on the server. Render a neutral value first and replace it after mount:

```tsx
function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(new Date(iso).toLocaleString()), [iso]);
  return <time dateTime={iso}>{text ?? "…"}</time>;
}
```

For a truly client-only widget, load it with `next/dynamic` and `ssr: false` from a Client Component.

### `suppressHydrationWarning`
It silences the warning for **one element's own text/attributes**, one level deep. Use it for deliberate differences like a timestamp, never as a general fix — the DOM still ends up with the client value and other mismatches are still bugs.

### Reading the error
React 19 reports hydration errors as one message with a diff of the server vs client output, which usually points straight at the text or attribute. The Next.js dev overlay shows the same diff.

## Follow-ups
- **What does React do on a mismatch?** — It discards the server HTML up to the nearest Suspense boundary and re-renders on the client, losing the SSR benefit and possibly flashing.
- **Why can't I just check `typeof window` to skip the server?** — Because the client's first render then differs from the HTML; that check is exactly what causes the mismatch.
- **How do you avoid a theme flash?** — Read the theme from a cookie on the server, or run a tiny blocking inline script that sets the class on `<html>` before first paint.

## Common Mistakes
- Using `suppressHydrationWarning` on a parent and expecting it to cover children.
- Thinking `"use client"` means "renders only in the browser".
- Fixing date mismatches by forcing the server's time zone, which then shows users the wrong time.

## Tips
- Memorable rule: "the first client render must be boring — identical to the server".
- List causes by category: environment (window, storage), non-determinism (random, time), locale, invalid HTML, extensions.
