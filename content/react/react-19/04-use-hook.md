---
title: "How does the use() API work with promises and context?"
level: hard
type: concept
tags: [use, suspense, promises, context, react-19]
related: [react/suspense-streaming, react/server-components-mental-model, react/use-context-rerenders, react/fetch-in-effect-race]
---

## Question
What is `use()` in React 19? How does it differ from `await` and from `useContext`, what are the rules for the promise you pass, and how do you handle loading and errors?

## Clues
- It can be called conditionally, unlike hooks.
- A pending promise suspends the component.
- Creating the promise during render creates a new one every render.

## Interview Answer
`use(resource)` reads a resource during render: given a promise it unwraps the value, suspending the component until it resolves so the nearest `Suspense` boundary shows its fallback; given a context it reads the value like `useContext`. Unlike hooks, it may be called inside conditionals and loops. A rejected promise throws to the nearest error boundary. The key rule is that the promise must be stable across renders: it should come from a Server Component prop, a cache, or `useMemo`/a library, not be created inline in a Client Component's render, otherwise every render creates a new promise and it suspends forever. In Server Components, `await` is preferred; `use` shines when a server component starts a fetch and passes the promise to a Client Component to unwrap, allowing streaming.

## Explanation
### Promise from server to client

```tsx
// app/page.tsx — Server Component
import { Suspense } from "react";
import Comments from "./Comments";

export default function Page() {
  const commentsPromise = getComments();             // not awaited: starts the request
  return (
    <>
      <Article />
      <Suspense fallback={<p>Loading comments…</p>}>
        <Comments promise={commentsPromise} />
      </Suspense>
    </>
  );
}
```

```tsx
// Comments.tsx
"use client";
import { use } from "react";

export default function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = use(promise);                     // suspends until resolved
  return <ul>{comments.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}
```

The article streams immediately; comments fill in when ready.

### Conditional context

```tsx
function Heading({ level, children }: { level: number; children: ReactNode }) {
  if (level === 0) return null;
  const theme = use(ThemeContext);                   // allowed after an early return
  return <h1 className={theme.heading}>{children}</h1>;
}
```

### Rules and pitfalls

| Rule | Why |
|---|---|
| Promise must be stable between renders | A new promise each render suspends again, forever |
| Create promises outside render (server prop, cache, library, `useMemo` with care) | `useMemo` isn't a guarantee; prefer a cache |
| Not inside `try/catch` | It throws a special value to suspend; use error boundaries |
| Wrap in `Suspense` | Otherwise nearest boundary is the root |
| Only during render | Not in event handlers or effects (use `await` there) |

```tsx
// Wrong in a Client Component
function Bad({ id }: { id: string }) {
  const user = use(fetch(`/api/users/${id}`).then((r) => r.json()));   // new promise each render
}
```

### Errors

```tsx
<ErrorBoundary fallback={<p>Failed to load</p>}>
  <Suspense fallback={<Spinner />}>
    <Comments promise={commentsPromise} />
  </Suspense>
</ErrorBoundary>
```

### `use` vs related tools

| Tool | Where | Use |
|---|---|---|
| `await` | async Server Components, handlers | simplest on the server |
| `use(promise)` | components and hooks during render | stream a promise to the client |
| `useEffect` + state | Client Components | legacy fetching, subscriptions |
| `useQuery` | Client Components | cached client fetching |

### Why it matters
It lets Client Components consume server-started data without waterfalls, integrates with Suspense and transitions, and replaces most "fetch in effect" code in RSC frameworks.

## Follow-ups
- **Is `use` a hook?** — It behaves like one but isn't bound by call-order rules.
- **Can you `use` a non-promise?** — Only context or thenables; for plain values just use them.

## Common Mistakes
- Creating the promise inside the Client Component render.
- Wrapping `use` in `try/catch`.
- Forgetting the Suspense boundary.

## Tips
- Show the server-starts, client-unwraps flow to prove you know the intended use.
