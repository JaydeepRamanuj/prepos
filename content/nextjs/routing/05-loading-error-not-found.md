---
title: "How do loading.tsx, error.tsx, not-found.tsx and global-error.tsx work together?"
level: medium
type: concept
tags: [loading, error-boundary, not-found, global-error, suspense, streaming]
related: [nextjs/app-router-file-conventions, nextjs/streaming-suspense, react/error-boundaries]
---

## Question
Explain what `loading.tsx`, `error.tsx`, `not-found.tsx` and `global-error.tsx` each do, which React primitive each maps to, and how errors and status codes behave when a page streams. Write a minimal `error.tsx` for Next.js 16.

## Clues
- Two of these are React boundaries you already know: one for pending, one for thrown errors.
- Where does each one sit relative to the layout in the same folder?
- Once the first byte of a streamed response is sent, can the status code change?

## Interview Answer
`loading.tsx` is sugar for a `<Suspense>` boundary around the segment's page: its fallback is prerendered and prefetched, so navigation shows it instantly while the page streams in. `error.tsx` is a React error boundary for the segment. It must be a Client Component, receives the thrown `error`, and in Next.js 16 gets a `retry()` function that re-fetches and re-renders the segment (older versions only had `reset()`). `not-found.tsx` renders when I call `notFound()` in that segment, and the root one also handles unmatched URLs. Both boundaries sit below the layout of their own folder, so a layout's errors bubble to the parent, and errors in the root layout need `global-error.tsx`, which replaces the whole document and so renders its own `<html>` and `<body>`. One subtlety: once streaming starts, the response is already `200`, so a `notFound()` thrown later can't change the status; Next.js injects a `noindex` meta tag instead.

## Explanation
### Mapping to React

| File | React primitive | Must be Client? | Wraps |
|---|---|---|---|
| `loading.tsx` | `<Suspense fallback>` | No | `not-found`, `page`, nested layouts |
| `error.tsx` | Error boundary | **Yes** | `loading`, `not-found`, `page`, nested layouts |
| `not-found.tsx` | Boundary for `notFound()` | No | `page` |
| `global-error.tsx` | Error boundary around the root layout | **Yes** | Everything; replaces `<html>` |

### A Next.js 16 `error.tsx`

```tsx
// app/dashboard/error.tsx
'use client' // error boundaries must be Client Components

import { useEffect } from 'react'

export default function DashboardError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    reportToSentry(error) // log once per error
  }, [error])

  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined

  return (
    <div role="alert">
      <h2>Couldn't load the dashboard.</h2>
      {digest && <p>Reference: {digest}</p>}
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

Details worth knowing:

- **Production hides server error messages.** Errors from Server Components arrive with a generic message and a `digest` hash, so you don't leak secrets. Match the digest against server logs.
- **`retry` vs `reset`.** `retry()` (stable in 16.3) re-fetches and re-renders the segment's children. `reset()` only clears the error state and re-renders without re-fetching, which often fails again for server errors. Before 16.2 the prop was only `reset`.
- **Event handler errors aren't caught.** Error boundaries catch errors during rendering. Catch errors in `onClick` handlers yourself, though errors thrown inside `startTransition` do bubble to the boundary.
- **Component-level boundaries.** Next.js 16.3 added `catchError` from `next/error` for boundaries that aren't tied to a route segment.

### `not-found` and `notFound()`

```tsx
// app/posts/[slug]/page.tsx
import { notFound } from 'next/navigation'

export default async function Post(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)
  if (!post) notFound() // throws; TypeScript knows it returns never
  return <article>{post.title}</article>
}
```

`app/not-found.tsx` also catches every URL that matches no route. For apps with multiple root layouts, the experimental `global-not-found.tsx` provides a single 404 that bypasses layouts.

### Streaming and status codes
The response's status is fixed when the first chunk is sent, and that happens as soon as a Suspense fallback (including `loading.tsx`) renders.

```txt
notFound() before any Suspense/await → real 404
notFound() after streaming started   → 200 + <meta name="robots" content="noindex">
redirect() after streaming started   → client-side redirect, not a 307 header
```

If you need a real 404 for SEO or analytics, run a fast existence check before rendering the boundary, or reject the request in `proxy.ts`.

### `global-error.tsx`
It's rarely seen because the root layout seldom throws. It replaces the root layout entirely, so it must render `<html>` and `<body>` and import its own styles. It can't export `metadata` (it's a Client Component); use React's `<title>` instead.

## Follow-ups
- **Why doesn't `loading.tsx` show while my layout fetches data?** — The Suspense boundary sits below the layout. Move the fetch into the page, or wrap that part of the layout in its own `<Suspense>`. With Cache Components the build tells you to do this.
- **`loading.tsx` or manual `<Suspense>`?** — `loading.tsx` gives a page-level skeleton that's prefetched for instant navigation. Granular `<Suspense>` around slow components streams more of the page sooner. Most real pages use both.
- **How do you show a 403?** — `forbidden()` with `forbidden.tsx`, behind the experimental `authInterrupts` flag. See the proxy/auth chapter.

## Common Mistakes
- Forgetting `'use client'` in `error.tsx`. The build fails.
- Expecting `app/dashboard/error.tsx` to catch errors thrown in `app/dashboard/layout.tsx`.
- Showing `error.message` to users in production and wondering why it's generic. Use `digest` plus logs.
- Calling `notFound()` deep inside a streamed component and expecting a 404 status.

## Tips
- Say "loading is Suspense, error is an error boundary". Interviewers want to hear that you see them as React primitives, not Next.js magic.
- Bring up the status-code-after-streaming point. It's a senior-level detail that few candidates know.
