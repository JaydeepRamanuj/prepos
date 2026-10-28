---
title: "useLayoutEffect vs useEffect — when do you need the layout version?"
level: medium
type: concept
tags: [useLayoutEffect, useEffect, layout, flicker, ssr]
related: [react/render-and-commit, react/use-effect-when-it-runs]
---

## Question
What's the difference between `useLayoutEffect` and `useEffect`? Give a concrete case where `useEffect` causes a visible bug and `useLayoutEffect` fixes it, and explain the cost.

## Interview Answer
Both run after React updates the DOM, but `useLayoutEffect` runs synchronously before the browser paints, while `useEffect` normally runs after paint. That matters when I need to measure the DOM and then change what's rendered — for example positioning a tooltip based on its height. With `useEffect` the user briefly sees the tooltip in the wrong spot, then it jumps; with `useLayoutEffect` the measurement and the re-render happen before the first paint, so there's no flicker. The cost is that it blocks painting, so slow work there directly hurts responsiveness. I default to `useEffect` and switch only for measure-then-update layout cases.

## Explanation
### Where each runs
```txt
render → commit DOM changes → useLayoutEffect (sync) → browser paints → useEffect
                                    │
                         state set here re-renders
                         before the user sees anything
```

### The tooltip case
```tsx
function Tooltip({ targetRect, children }: { targetRect: DOMRect; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    // measure after DOM exists, before paint
    setHeight(ref.current!.getBoundingClientRect().height);
  }, [children]);

  // place above the target; if it doesn't fit, place below
  const fitsAbove = targetRect.top - height >= 0;
  const top = fitsAbove ? targetRect.top - height : targetRect.bottom;

  return (
    <div ref={ref} style={{ position: "fixed", top, left: targetRect.left }}>
      {children}
    </div>
  );
}
```
1st render: `height` is 0, tooltip placed wrongly. Layout effect measures, sets height → React re-renders synchronously → browser paints only the correct position. Swap in `useEffect` and the wrong position is painted for a frame.

### Typical uses
- Measuring elements (size/position) to place popovers, tooltips, virtualised rows.
- Scroll restoration or keeping scroll anchored after content changes.
- Synchronously reading layout before a CSS animation starts.

### Costs and caveats
- **Blocks paint** — expensive work here makes interactions feel slow (it hurts INP).
- **Server rendering** — layout effects don't run on the server, so the server HTML is rendered without the measured value. Plan for a sensible initial render or render the measured part only on the client.
- State updates inside layout effects are processed synchronously, so they also block.

### Related hooks
| Hook | Timing | Use |
|---|---|---|
| `useInsertionEffect` | before layout effects, before DOM reads | CSS-in-JS libraries inserting `<style>` tags |
| `useLayoutEffect` | after DOM mutation, before paint | measure & adjust layout |
| `useEffect` | after paint (usually) | everything else: subscriptions, fetching, logging |

Note: if a `useEffect` was triggered by a discrete user input (like a click), React may run it before paint anyway — but you shouldn't rely on that.

## Follow-ups
- **Could CSS solve the tooltip?** — Often yes: CSS anchor positioning or a library like Floating UI handles placement; measure in JS only when needed.
- **Why not always use `useLayoutEffect` to be safe?** — It delays every paint for work that doesn't need to block it.

## Common Mistakes
- Using `useLayoutEffect` for data fetching or subscriptions.
- Thinking `useLayoutEffect` runs *before* the DOM updates — it runs after mutation, before paint.

## Tips
- Explain it with the word "flicker": "if you'd see a flash of wrong layout, use the layout version."
