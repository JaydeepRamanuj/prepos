---
title: "How do you use React DevTools to find out why a component re-renders?"
level: medium
type: concept
tags: [react-devtools, profiler, re-renders, performance]
related: [debugging/chrome-devtools-beyond-console-log, scenarios/app-slow-after-release, debugging/stale-closure-interval]
---

## Question
Typing in a search box feels laggy, and you suspect half the page re-renders on every keystroke. How would you use React DevTools to confirm which components re-render and why?

## Interview Answer
I start in the Components tab to check props, state and hooks of the suspected component and to turn on "Highlight updates when components render", which flashes everything that re-renders while I type. Then I switch to the Profiler, enable "Record why each component rendered while profiling" in its settings, record a few keystrokes and stop. The flame graph shows which components rendered in each commit and how long they took, and selecting one tells me why — props changed (and which), state or hooks changed, or the parent rendered. Usually the answer is a new object or function prop on every render, or a context value that changes too often, and I fix that cause rather than sprinkling `memo` everywhere.

## Explanation
### Components tab: inspect
- Select a component to see its **props, state, hooks** (with hook names), and **rendered by** (owner chain).
- Edit state or props live to test a hypothesis without changing code.
- The `<>` icon jumps to source; the bug icon logs the component's data to the console; `$r` in the console refers to the selected component.
- Settings → **Highlight updates when components render** gives a quick visual of render scope.
- Components optimised by the React Compiler are marked with a "Memo ✨" badge, so you can check whether the compiler actually handled a component.

### Profiler tab: measure
1. Settings (gear) → Profiler → **Record why each component rendered while profiling**.
2. Click record, perform the slow interaction, stop.
3. Read the result:

```txt
commits:  ▮ ▮ ▮ ▮ ▮ ▮  ← one bar per commit; tall/yellow = slow
flame graph (commit 3):
  App ─────────────────────────────── 18.2ms
    SearchPage ────────────────────── 17.9ms
      SearchInput ── 0.3ms
      ProductGrid ────────────────── 17.1ms   why? "Props changed: filters"
        ProductCard × 200 ────────── 16ms     why? "The parent component rendered"
```

- **Flame graph**: grey components did not render in this commit.
- **Ranked chart**: components sorted by render time in that commit — the fastest way to find the hot spot.
- Hover a component: "Why did this render?" lists *props changed (names)*, *hooks changed*, *context changed*, or *parent rendered*.

### Mapping causes to fixes

```tsx
// Cause: a new object on every render → ProductGrid's "filters" prop always "changed"
<ProductGrid filters={{ category, sort }} />

// Fix options
const filters = useMemo(() => ({ category, sort }), [category, sort]);
// ...or pass primitives, or move the input's state down so the grid isn't a child of it
```

| "Why did this render?" | Typical fix |
|---|---|
| Parent rendered | Move state down / lift content up (pass as `children`), or `memo` the child |
| Props changed: `onClick` | Stable callback (`useCallback`) or let the React Compiler handle it |
| Context changed | Split the context, or memoize its value |
| Hook changed | Check which state/selector updates; subscribe to less |

Note that a re-render is not automatically a problem; it matters when the Profiler shows real time spent. Confirm with the Chrome Performance panel too — React 19.2 adds React-specific tracks (Scheduler and Components) to Chrome's performance profiles, so you can see React work next to network and layout.

## Follow-ups
- **Why use a production profiling build?** — Development mode does extra work (StrictMode double rendering, warnings), so absolute timings are inflated; use dev for "what renders" and a profiling build for "how slow".
- **The Profiler says "Hooks changed" — how do you find which one?** — It shows the hook index; match it to the hook list in the Components tab, where hooks are numbered in order.
- **Does the React Compiler make this obsolete?** — It removes most manual memoization work, but you still need the Profiler to find expensive renders and context fan-out it cannot fix.

## Common Mistakes
- Wrapping every component in `memo` before measuring.
- Forgetting to enable "record why" and then guessing the cause.
- Reading timings from a development build as if they were production numbers.

## Tips
- Say the flow: highlight updates → profile → "why did this render" → fix the cause → profile again to prove it.
- Mention the ranked chart; it shows you know how to find the hotspot in seconds.
