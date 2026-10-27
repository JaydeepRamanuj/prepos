---
title: "Why does my effect run twice in development? Explain StrictMode"
level: medium
type: concept
tags: [strict-mode, effects, purity, development]
related: [react/use-effect-cleanup, react/render-and-commit, react/fetch-in-effect-race]
---

## Question
A teammate notices `console.log` in their component prints twice and their `useEffect` opens two WebSocket connections — but only in development. What is going on, what exactly does StrictMode do, and how should the code be fixed?

## Interview Answer
That's `<StrictMode>`, which most frameworks (including Next.js by default) enable in development. It double-invokes functions that should be pure — component bodies, `useState`/`useMemo`/`useReducer` initializers and updaters — so accidental side effects become visible. It also runs every effect's setup, then cleanup, then setup again on mount, and does the same for ref callbacks, to simulate a component being unmounted and remounted. None of this happens in production. Two connections means the effect has no cleanup; the fix is to return a function that disconnects, so setup → cleanup → setup leaves exactly one live connection. I wouldn't remove StrictMode or add a "has run" ref to silence it — that hides a real bug.

## Explanation
### What StrictMode does (development only)
| Check | What it catches |
|---|---|
| Calls component body twice per render | Mutating props/globals during render |
| Calls `useState`/`useReducer` initializers and updater functions, and `useMemo` calculations twice | Impure initializers and reducers |
| Extra setup → cleanup → setup for every effect on mount | Missing or incomplete cleanup |
| Extra setup → cleanup cycle for ref callbacks on mount | Ref callbacks that leak (React 19) |
| Warnings for deprecated APIs | e.g. `UNSAFE_componentWillMount` |

In React 19, on the second render `useMemo` and `useCallback` reuse the first render's memoized result. React DevTools dims the logs from the second call.

### Why simulate an unmount/remount?
Real apps unmount and remount components all the time: navigating away and back, Suspense fallbacks replacing content, `<Activity>` hiding a subtree, Fast Refresh. If an effect only works when run exactly once, it will break in those cases. StrictMode surfaces that on the very first mount.

### The fix
```tsx
useEffect(() => {
  const socket = new WebSocket(`wss://chat.example.com/${roomId}`);
  socket.onmessage = (e) => setMessages((m) => [...m, e.data]);
  return () => socket.close(); // cleanup mirrors setup
}, [roomId]);
```
Dev timeline: connect → close → connect. One open socket — the same state production reaches.

### Common cases
- **Fetching** — two requests in dev is fine if you ignore or abort the first one in cleanup (an `ignore` flag or `AbortController`).
- **Analytics on mount** — fires twice in dev only; acceptable, or send it from the event that caused the navigation.
- **Animations / third-party widgets** — cleanup must reset or destroy them.
- **One-time app init** (e.g. reading a token) — put it at module top level, outside components.

## Follow-ups
- **Does StrictMode affect production performance?** — No, all checks are stripped from production builds.
- **Can I disable the double effect for one component?** — No opt-out within a StrictMode tree; fix the cleanup instead. Only wrapping part of the app changes which components are checked.
- **Why do logs print twice but state updates don't double?** — React discards the second render's result; it's just checking that both produce the same output.

## Common Mistakes
- Removing `<StrictMode>` to "fix" the bug.
- Using a `useRef(false)` "did run" guard — production remounts (navigation, Suspense) still break.
- Assuming StrictMode runs in production.

## Tips
- Frame it as "StrictMode is a free test: setup → cleanup → setup must be indistinguishable from setup once". That's the line interviewers want.
