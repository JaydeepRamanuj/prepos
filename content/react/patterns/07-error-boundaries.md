---
title: "How do error boundaries work, and what do they not catch?"
level: hard
type: concept
tags: [error-boundaries, componentDidCatch, errors, suspense, resilience]
related: [javascript/unhandled-rejections, react/suspense-streaming, nextjs/loading-error-not-found]
---

## Question
Explain error boundaries: what they catch, what they don't, how to write one, how reset works, and how React 19 changed error reporting. How do they relate to Next.js `error.tsx`?

## Clues
- They are still class components (no hook equivalent).
- Think about which errors happen outside rendering.
- Where do you place them: one at the root, or several?

## Interview Answer
An error boundary is a class component that defines `static getDerivedStateFromError` (to switch to a fallback UI) and optionally `componentDidCatch` (to log). It catches errors thrown while rendering, in lifecycle methods and in constructors of its descendants, and shows a fallback instead of unmounting the whole app. It doesn't catch errors in event handlers, async code like promises and timers, server-side rendering, or errors thrown by the boundary itself; those need `try/catch` or a rejected promise handler. I place several: a top-level one as a last resort and feature-level ones so one widget can fail alone, with a reset mechanism, such as a "Try again" button that clears the error state. React 19 reports errors through `onCaughtError`, `onUncaughtError` and `onRecoverableError` root options. In Next.js, an `error.tsx` file creates a boundary for the route segment.

## Explanation
### A boundary

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { fallback: (error: Error, reset: () => void) => ReactNode; children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };                       // next render shows the fallback
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportToMonitoring(error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children;
  }
}

<ErrorBoundary fallback={(e, reset) => <div role="alert">{e.message} <button onClick={reset}>Retry</button></div>}>
  <Widget />
</ErrorBoundary>
```

Most teams use the `react-error-boundary` package, which provides `ErrorBoundary`, `useErrorBoundary` and `resetKeys`.

### What is and isn't caught

| Caught | Not caught |
|---|---|
| Errors during render of descendants | Event handlers (`onClick`) |
| Lifecycle methods and constructors | Async code (promises, `setTimeout`) |
| Errors thrown by `use()`-ed rejected promises or lazy loading failures | Server-side rendering errors (handled by the framework) |
| | Errors in the boundary itself (bubbles to the next one up) |

### Handling errors outside rendering
Either catch and store them in state, then throw during render to reach the boundary:

```tsx
const { showBoundary } = useErrorBoundary();       // react-error-boundary
fetchData().catch(showBoundary);

// or manually
const [, setState] = useState();
const throwAsync = (e: Error) => setState(() => { throw e; });
```

### Reset strategies
- Button that clears state (`reset`).
- `resetKeys`: reset when route or id changes.
- `key` on the boundary to remount fully.

### Placement
Root (never a blank screen), route level, around risky third-party widgets, and around independently loading sections (paired with Suspense).

```tsx
<ErrorBoundary fallback={...}>
  <Suspense fallback={<Skeleton />}>
    <Comments />
  </Suspense>
</ErrorBoundary>
```

### React 19 reporting
`createRoot(el, { onCaughtError, onUncaughtError, onRecoverableError })` centralises logging; errors are no longer logged twice as in React 18. Hydration mismatches show a single diff.

### Next.js
`error.tsx` is a Client Component boundary for its segment and children (it receives `error` and `reset`); `global-error.tsx` handles root layout errors; `not-found.tsx` handles 404s. Errors in Server Components in production are sanitised to avoid leaking details; use the digest to match logs.

## Follow-ups
- **Why no hook?** — Catching errors needs lifecycle methods with no hook equivalent yet.
- **Does it catch errors in `useEffect`?** — Yes if thrown synchronously in the effect; async errors need explicit handling.

## Common Mistakes
- Expecting it to catch event handler errors.
- A single boundary at the root only.
- No way to reset, leaving users stuck.

## Tips
- Say "render-phase errors only" and list what to do for the rest.
