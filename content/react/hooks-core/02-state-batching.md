---
title: "What is automatic batching, and how many times does this component render?"
level: medium
type: concept
tags: [useState, batching, flushSync, react-18]
related: [react/use-state-functional-updates, react/render-and-commit, react/why-component-rerenders]
---

## Question
What is state update batching in React? How many renders does this click cause in React 18+, and how would the answer have differed in React 17?

```tsx
function Profile() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const user = await fetchUser();
    setName(user.name);
    setLoading(false);
  }
  return <button onClick={handleClick}>{loading ? "…" : name}</button>;
}
```

## Interview Answer
Batching means React groups several state updates into a single re-render instead of rendering after each one. Since React 18, with `createRoot`, batching is automatic everywhere — event handlers, promises, `setTimeout`, native listeners. In this handler, `setLoading(true)` causes one render; after the `await`, `setName` and `setLoading(false)` are batched into one more, so two renders total. In React 17 only updates inside React event handlers were batched, so the two updates after `await` would each have caused a separate render — three in total, with a brief intermediate state. If I ever need the DOM updated synchronously in the middle, I can use `flushSync` from `react-dom`, but that's rare.

## Explanation
### What batching buys you
Without batching, every `setState` would run the render phase and commit separately, and the user could see half-updated UI (name set but still showing a spinner). React waits until the current synchronous code finishes, then processes all queued updates together.

```txt
click ─▶ setLoading(true) ─▶ (sync code ends) ─▶ render #1
await resolves ─▶ setName, setLoading(false) ─▶ (sync code ends) ─▶ render #2
```

The `await` splits the handler into two synchronous chunks, and each chunk is one batch.

### React 17 vs 18+
| Where the update happens | React 17 (`ReactDOM.render`) | React 18+ (`createRoot`) |
|---|---|---|
| React event handler | batched | batched |
| `setTimeout`, promise `.then`, after `await` | **not** batched | batched |
| Native `addEventListener` handler | **not** batched | batched |

`ReactDOM.render` was removed in React 19, so every app now uses `createRoot` and gets automatic batching.

### Opting out with `flushSync`
```tsx
import { flushSync } from "react-dom";

function addMessage(text: string) {
  flushSync(() => {
    setMessages((m) => [...m, text]);
  });
  // DOM is updated here, so we can scroll to the new last item
  listRef.current?.lastElementChild?.scrollIntoView();
}
```
`flushSync` forces React to render and commit the updates inside it immediately. It hurts performance if overused; reach for it only when you must read the updated DOM right away.

### Batching ≠ merging values
Batching only decides *when* the render happens. Values still go through the update queue in order, so `setCount(c => c + 1)` twice in one batch gives +2.

## Follow-ups
- **Do updates across different components batch together?** — Yes, all updates queued in the same tick are rendered in one pass, even if they belong to different components.
- **How does this relate to Transitions?** — Updates inside `startTransition` are lower priority and can be interrupted, but they are batched too.

## Common Mistakes
- Thinking each `setState` causes an immediate render.
- Believing batching only happens in event handlers (true only in React 17 and earlier).
- Reading the DOM right after `setState` and expecting new content.

## Tips
- Mention "the `await` splits the handler into two batches" — it shows you understand batching is per synchronous chunk.
