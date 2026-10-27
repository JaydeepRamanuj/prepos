---
title: "What is the Activity component, and how does it differ from conditional rendering?"
level: advanced
type: concept
tags: [Activity, react-19-2, state-preservation, offscreen, performance]
related: [react/use-effect-cleanup, react/strict-mode-double-invoke, nextjs/layout-vs-template]
---

## Question
React 19.2 added `<Activity>`. What does `mode="hidden"` do compared with unmounting or CSS `display: none`? What happens to state, effects and rendering priority, and where would you use it?

## Clues
- Think about tabs or back-navigation where you want to keep state.
- Effects of hidden trees are cleaned up.
- Hidden content still renders, but at low priority.

## Interview Answer
`<Activity mode="visible" | "hidden">` lets you hide part of the UI while React preserves its state. When hidden, React hides the DOM (with `display: none`), unmounts its effects (running cleanups, so subscriptions and timers stop), keeps the component state and DOM alive, and continues to render updates at lower priority, only when idle. Compared with conditional rendering, state isn't lost and the UI comes back instantly; compared with plain CSS hiding, effects are paused so hidden parts don't keep running side effects or fetching, and rendering work is deprioritised. It's good for tab panels, wizards and back/forward navigation where users expect their scroll and input to be restored, and for pre-rendering likely next screens. Cost: memory, since hidden trees stay mounted.

## Explanation
### Usage

```tsx
import { Activity } from "react";

function Tabs({ tab }: { tab: "inbox" | "drafts" | "sent" }) {
  return (
    <>
      <Activity mode={tab === "inbox" ? "visible" : "hidden"}><Inbox /></Activity>
      <Activity mode={tab === "drafts" ? "visible" : "hidden"}><Drafts /></Activity>
      <Activity mode={tab === "sent" ? "visible" : "hidden"}><Sent /></Activity>
    </>
  );
}
```

Switching tabs doesn't lose a half-typed draft, scroll position or expanded rows.

### Comparison

| Approach | State kept | DOM kept | Effects run | Render work |
|---|---|---|---|---|
| `{show && <X />}` | no | no | cleaned up (unmount) | none |
| CSS `display: none` | yes | yes | keep running | normal priority |
| `<Activity mode="hidden">` | yes | yes (hidden) | cleaned up, restarted when visible | low priority |

### What this means for effects
When a tree becomes hidden, React runs its effect cleanups as if unmounted (but without losing state); when visible again, effects re-run. So an effect that subscribes to a socket disconnects while hidden. This is also why StrictMode-style resilience (effects that clean up correctly and can be re-run) matters.

```tsx
useEffect(() => {
  const sub = store.subscribe(onChange);
  return () => sub.unsubscribe();       // runs when hidden; re-subscribes when visible
}, []);
```

Layout effects behave similarly. Side effects that must continue while hidden (analytics timers) should not live in hidden trees.

### Pre-rendering
Rendering a likely next view in `hidden` mode lets React render it during idle time so navigation feels instant. Data fetching in hidden Suspense-based components can start early.

### Frameworks
Next.js with `cacheComponents` keeps recently visited routes mounted but hidden via Activity so going back restores state. Router libraries may adopt it for back/forward navigation.

### Caveats
- Memory grows with the number of hidden trees; limit how many you keep.
- Hidden DOM can still include elements that screen readers or find-in-page might treat specially; hidden uses `display: none`, so they are excluded from the accessibility tree.
- Side effects in render (impure code) will be exposed.
- Not a replacement for virtualization or for lifting state that must persist beyond the lifetime of the component.

## Follow-ups
- **Does hidden content get updated?** — Yes, it re-renders for new props/state at low priority.
- **Alternative before 19.2?** — Lifting state up, or keeping everything mounted with CSS.

## Common Mistakes
- Assuming hidden effects keep running.
- Using Activity for dozens of heavy screens.

## Tips
- Contrast the three approaches in a table to show you understand the trade-offs.
