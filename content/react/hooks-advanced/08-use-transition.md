---
title: "What does useTransition do, and how is it different from debouncing?"
level: hard
type: concept
tags: [useTransition, startTransition, concurrent-rendering, urgent-updates, isPending]
related: [react/use-deferred-value, react/react-18-to-19-changes, react/use-optimistic]
---

## Question
Explain `useTransition`. What is an urgent update versus a transition update, what does `isPending` tell you, and how does it differ from debouncing or `setTimeout`?

## Clues
- React can prioritise some state updates over others.
- A transition render can be interrupted by urgent input.
- In React 19, the function passed to `startTransition` can be async.

## Interview Answer
`useTransition` returns `[isPending, startTransition]`. Updates wrapped in `startTransition` are marked non-urgent: React renders them in the background, can interrupt that render if something urgent like typing or clicking happens, and keeps showing the old UI until the new one is ready, rather than a blank state or fallback. `isPending` is true while the transition is in progress, so I can show a subtle indicator. It differs from debouncing because nothing is delayed by a timer: React starts rendering immediately but at lower priority, so on a fast machine it finishes right away and on a slow one it stays responsive. It doesn't make renders cheaper or avoid the work; it only schedules it. In React 19, transitions can wrap async functions, which is how Actions track pending state.

## Explanation
### Typical case: tabs with a heavy panel

```tsx
function Tabs() {
  const [tab, setTab] = useState("home");
  const [isPending, startTransition] = useTransition();

  function select(next: string) {
    startTransition(() => {
      setTab(next);                 // non-urgent: heavy render can be interrupted
    });
  }

  return (
    <>
      <nav aria-busy={isPending}>
        {["home", "posts", "reports"].map((t) => (
          <button key={t} onClick={() => select(t)}>{t}</button>
        ))}
      </nav>
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <Panel tab={tab} />          {/* heavy */}
      </div>
    </>
  );
}
```

Clicking another tab while "reports" is rendering abandons the in-progress render and starts the newest one.

### Transitions with Suspense
Updating inside a transition avoids replacing already-visible content with a Suspense fallback; React keeps the old UI and shows `isPending` until the new data is ready. Only content that has not been shown before (the first reveal) uses fallbacks.

### Async transitions (React 19)

```tsx
startTransition(async () => {
  await saveSettings(form);         // pending until the promise settles
  startTransition(() => setSaved(true));   // updates after await need their own startTransition
});
```

State updates after an `await` must be wrapped again in `startTransition`.

### Versus debouncing and timers

| | Transition | Debounce / `setTimeout` |
|---|---|---|
| Delay | none; scheduling priority | fixed time delay |
| Interruptible | yes | not applicable |
| Adapts to device speed | yes | no |
| Reduces work | no | yes (fewer calls) |
| Best for | slow renders | slow network calls |

For a search box, combine them: debounce the request, use a transition or `useDeferredValue` for the results rendering.

### Limits
- Only state updates inside the callback are non-urgent; controlled input values should stay urgent.
- Doesn't help if one component is slow because of a synchronous expensive computation without any ability to yield, only if the work is rendering React.
- `startTransition` (without the hook) works anywhere but gives no `isPending`.
- Don't wrap setState for text inputs themselves.

## Follow-ups
- **Does it make my render faster?** — No, it only prioritises; optimise the slow component separately.
- **useTransition vs useDeferredValue?** — Transition wraps the setter you control; deferred value wraps a value you receive (like a prop).

## Common Mistakes
- Putting the controlled input's `setState` inside `startTransition`, making typing laggy.
- Expecting it to cancel network requests.
- Forgetting to wrap updates after an `await`.

## Tips
- Say "priority, not delay" to distinguish it from debounce.
