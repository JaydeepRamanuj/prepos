---
title: "What problem does useEffectEvent solve?"
level: advanced
type: concept
tags: [useEffectEvent, effects, dependencies, events, react-19]
related: [react/stale-closures-in-effects, react/use-effect-dependency-array, react/you-might-not-need-an-effect, react/use-event-listener]
---

## Question
What is `useEffectEvent`? When would you use it instead of adding a dependency or using a ref, and what are its rules?

## Clues
- Some values should be read by an effect without making the effect re-run when they change.
- The function it returns always sees the latest props and state.
- It is not meant to be passed around or called from during render.

## Interview Answer
`useEffectEvent` wraps a function so that it always sees the latest props and state, but is not reactive: it is not a dependency of effects that call it. It solves the case where an effect should synchronise with some values, like a chat room id, yet also needs to read other values, like a theme or a callback prop, at the moment an event happens, without reconnecting every time those change. Before it, people used refs updated every render or suppressed the lint rule. It was added in React 19.2. Rules: call it only from inside effects (or other effect events), never during render or pass it to children, and don't use it just to hide dependencies that should legitimately re-run the effect.

## Explanation
### The problem

```tsx
function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  useEffect(() => {
    const conn = connect(roomId);
    conn.on("connected", () => showToast("Connected", theme));
    return () => conn.disconnect();
  }, [roomId, theme]);      // switching theme reconnects the chat: wrong
}
```

`theme` is read inside the effect, so the linter requires it as a dependency, but a theme change should not reconnect.

### The solution

```tsx
import { useEffect, useEffectEvent } from "react";

function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  const onConnected = useEffectEvent(() => {
    showToast("Connected", theme);        // always the latest theme
  });

  useEffect(() => {
    const conn = connect(roomId);
    conn.on("connected", onConnected);
    return () => conn.disconnect();
  }, [roomId]);                           // effect events are not dependencies
}
```

The effect now depends only on what it synchronises with: `roomId`.

### Reactive vs non-reactive logic

| Code | Reactive? | Where it belongs |
|---|---|---|
| "Connect to this room" | yes: re-run when `roomId` changes | effect body |
| "Show a toast with the current theme when connected" | no: just needs latest value | effect event |

### Callback props

```tsx
function useInterval(callback: () => void, delay: number) {
  const tick = useEffectEvent(callback);
  useEffect(() => {
    const id = setInterval(() => tick(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

Parents can pass an inline arrow without causing the interval to restart.

### Rules and limits
- Only call effect events from effects, or from other effect events.
- Don't pass them to other components or hooks, and don't put them in dependency arrays (the linter knows).
- They are not event handlers for the UI; normal handlers in JSX need nothing special.
- Don't use it to skip dependencies that *should* cause a re-run. If a value changes the meaning of the effect, keep it a dependency.
- Requires React 19.2 or later; the `eslint-plugin-react-hooks` v6+ understands it.

### Alternative before it existed

```tsx
const latest = useRef(theme);
useLayoutEffect(() => { latest.current = theme; });   // or in an effect
// read latest.current inside the effect
```

## Follow-ups
- **Why not just use a ref?** — A ref works, but it is manual, easy to get wrong, and the linter cannot verify it.
- **Does it re-render anything?** — No; it just returns a stable function.

## Common Mistakes
- Using it to silence a legitimate dependency.
- Calling it during render.

## Tips
- Frame it as separating "what to synchronise with" from "what to read at event time".
