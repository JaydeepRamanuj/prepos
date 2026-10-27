---
title: "How do Suspense and streaming SSR work together?"
level: hard
type: concept
tags: [suspense, streaming, ssr, loading-states, selective-hydration]
related: [react/use-hook, react/server-components-mental-model, nextjs/loading-error-not-found, react/use-transition]
---

## Question
What does `<Suspense>` do, how does it enable streaming server rendering and selective hydration, and how do boundaries and transitions affect what the user sees?

## Clues
- A component can "suspend" while waiting for data or code.
- The server doesn't have to wait for the slowest part before sending HTML.
- The browser can hydrate parts of the page independently.

## Interview Answer
`<Suspense fallback>` lets a part of the tree declare that it's waiting, for data via `use()`, or a framework data API, or lazy code, and shows the fallback until it's ready. With streaming SSR the server sends the HTML shell immediately with fallbacks in place, then streams each suspended section's HTML later with a small inline script that swaps it in, so slow data doesn't block the first paint. On the client, selective hydration hydrates boundaries independently and prioritises the one the user interacts with. Where I place boundaries decides granularity: one around the whole page gives all-or-nothing, several give progressive reveal. Updates inside a transition keep old content rather than re-showing a fallback.

## Explanation
### Without and with streaming

```txt
Blocking SSR:  fetch everything -> render all -> send HTML -> hydrate everything
Streaming:     send shell (nav, headings, fallbacks) -> stream sections as data resolves
               -> hydrate shell and sections independently
```

### Placement

```tsx
export default function Page() {
  return (
    <>
      <Header />                                   {/* instant */}
      <Suspense fallback={<FeedSkeleton />}>
        <Feed />                                   {/* slow query */}
      </Suspense>
      <Suspense fallback={<SidebarSkeleton />}>
        <Recommendations />                        {/* slower still */}
      </Suspense>
    </>
  );
}
```

Each boundary resolves on its own; neither blocks the other. In Next.js, a `loading.tsx` file wraps the page in an implicit Suspense boundary.

### What suspends
- `use(promise)` with a pending promise.
- Server Components that `await` data.
- `React.lazy` components loading code.
- Suspense-enabled libraries (TanStack Query `useSuspenseQuery`, Relay).
- Not effects or event handlers: fetching in `useEffect` doesn't trigger Suspense.

### Selective hydration
Streamed sections hydrate as their code arrives; if the user clicks inside a not-yet-hydrated boundary, React raises its priority and replays the event once hydrated.

### Interaction with transitions

```tsx
const [isPending, startTransition] = useTransition();
startTransition(() => setTab("reports"));   // old tab stays visible; no fallback flash
```

Without a transition, a new suspending subtree replaces visible content with the fallback. Pairing `useDeferredValue` or `startTransition` with Suspense avoids hiding content already shown.

### Nesting and reveal order
Outer boundaries reveal before inner ones. `unstable_SuspenseList` was an experiment; in practice use layout design or `Suspense` order.

### Errors
Wrap with an error boundary: a rejected promise in a suspended subtree throws to the closest boundary.

### SEO and status codes
Streamed content is still in the HTML response, so crawlers see it. Once streaming starts, the HTTP status and headers are sent; a later `notFound()` or redirect can't change them (frameworks handle this via metadata and client redirects), so decide 404s before the first flush where it matters.

### Design tips
- Fallbacks should match layout size to avoid layout shift.
- Don't over-fragment: many tiny spinners feel janky; group things that should appear together.
- Cache or share fetches so a boundary's data isn't requested twice.

## Follow-ups
- **What's the difference between Suspense and `isLoading` flags?** — Suspense is declarative and composable; flags require every component to manage loading.
- **Can Suspense catch errors?** — No, only waiting; errors go to error boundaries.

## Common Mistakes
- One boundary at the root, defeating streaming.
- Expecting `useEffect` fetches to trigger Suspense.
- Fallbacks that cause layout shift.

## Tips
- Walk the timeline: shell first, sections later, hydrate independently.
