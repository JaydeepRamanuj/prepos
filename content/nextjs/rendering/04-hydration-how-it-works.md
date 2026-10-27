---
title: "What is hydration, and what are common causes of hydration errors?"
level: hard
type: concept
tags: [hydration, ssr, mismatch, useEffect, suppressHydrationWarning]
related: [nextjs/hydration-mismatch-scenario, react/suspense-streaming, react/use-id, react/use-sync-external-store]
---

## Question
What happens during hydration? Why do mismatches occur, how does React 19 report them, and what are the right and wrong ways to fix them?

## Clues
- The server sends HTML; the client must produce the same tree to attach to it.
- Anything that differs between server and first client render is a candidate.
- Do not make the first client render differ from the server unless you intend to update afterwards.

## Interview Answer
Hydration is React attaching event handlers and state to HTML that the server already rendered. The client runs the same components and expects the output to match the existing DOM; if it does, React reuses the DOM nodes, and if not it logs a hydration mismatch and may discard server HTML and re-render on the client. Mismatches come from values that differ between environments: `Date.now()` or `Math.random()`, `window` and `localStorage` checks, time zones and locales in formatting, user-agent or viewport branching, browser extensions modifying the DOM, and invalid HTML nesting like `<div>` inside `<p>`. The fix is to make the first render deterministic, then update after mount in an effect (or use `useSyncExternalStore` with a server snapshot), use `useId` for ids, and as a last resort `suppressHydrationWarning` for a single unavoidable text node such as a timestamp.

## Explanation
### The process

```txt
1. Server renders components -> HTML (+ RSC payload)
2. Browser shows HTML immediately (not yet interactive)
3. JS loads; React renders the same tree on the client
4. React compares with DOM, attaches handlers, becomes interactive
```

With streaming and Suspense, React hydrates boundaries independently and prioritises the part the user interacts with (selective hydration).

### Typical causes and fixes

| Cause | Example | Fix |
|---|---|---|
| Non-deterministic values | `<p>{Math.random()}</p>`, `new Date()` | compute on the server and pass down, or set in an effect after mount |
| Browser-only checks | `typeof window !== "undefined" ? A : B` in render | render the same on first pass; update in `useEffect` |
| Locale/time zone | `toLocaleString()` differing between server and user | format with explicit locale and `timeZone`, or render client-side after mount |
| Invalid nesting | `<p><div/></p>`, `<a>` inside `<a>`, `<table>` without `<tbody>` | fix the HTML structure |
| Extensions/dark-mode scripts | injected attributes on `<html>` | `suppressHydrationWarning` on that element (one level) |
| Random ids | `id={Math.random()}` | `useId()` |
| External stores | `localStorage` themes | `useSyncExternalStore(sub, get, getServerSnapshot)` or cookies read on the server |

### Two-pass rendering pattern

```tsx
function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => new Date(iso).toISOString());   // same on both sides
  useEffect(() => {
    setText(new Date(iso).toLocaleString());                              // client-only refinement
  }, [iso]);
  return <time dateTime={iso}>{text}</time>;
}
```

### Using `suppressHydrationWarning`
It silences mismatch warnings for that element's text/attributes only, one level deep. It doesn't repair differences; use it for things like a timestamp or the `<html>` class set by a theme script.

```tsx
<time suppressHydrationWarning>{new Date().toLocaleTimeString()}</time>
```

### React 19 reporting
React 19 shows a single diff of the mismatch instead of several cryptic errors. Also, third-party scripts in `<head>` and `<body>` are tolerated (unexpected tags are skipped), reducing false positives. Recoverable errors go to `onRecoverableError`.

### Avoiding the flash for client-only state (themes)
Read the preference from a cookie on the server and render the correct class in HTML, or inline a tiny script before paint plus `suppressHydrationWarning` on `<html>`. A `useEffect` that sets the theme after load causes a visible flash.

### Diagnosing
1. Read the diff in the error message.
2. Search the component for the sources above.
3. Compare server HTML (View Source) with the client DOM.
4. Disable browser extensions to rule them out.
5. Test in production mode as dev adds noise.

## Follow-ups
- **Why not just return `null` on the server?** — It causes a layout shift and removes content from the HTML (SEO); use `Suspense` or `next/dynamic` with `ssr: false` for truly client-only widgets.
- **Do Server Components hydrate?** — No; only Client Components hydrate.

## Common Mistakes
- Using `typeof window` branches in render.
- Fixing everything with `suppressHydrationWarning`.
- Invalid HTML nesting.

## Tips
- Mention the two-pass render and `useSyncExternalStore`; they show current best practice.
