---
title: "What are the App Router's special files, and in what order do they wrap a page?"
level: easy
type: concept
tags: [app-router, file-conventions, layout, page, loading, error]
related: [nextjs/layout-vs-template, nextjs/loading-error-not-found, nextjs/route-groups-private-folders]
---

## Question
In the Next.js App Router, folders define routes and certain file names have special meaning. Name the special files, say what each one does, and explain how they nest inside each other for a single route segment.

## Interview Answer
In the App Router every folder under `app/` is a route segment, but a folder only becomes a public URL when it contains a `page.tsx` (UI) or a `route.ts` (an HTTP handler). Around the page, Next.js composes the special files into a fixed hierarchy: `layout` is outermost, then `template`, then `error` as an error boundary, then `loading` as a Suspense boundary, then `not-found`, and finally the `page` or a nested layout. Because `error` sits inside `layout`, an error boundary can't catch errors thrown by the layout in the same folder; that's why the root has `global-error`. Parallel routes add `default.tsx` as the fallback for slots. All of these are Server Components by default, except `error` and `global-error`, which must be Client Components because React error boundaries run on the client.

## Explanation
### The files

| File | Purpose |
|---|---|
| `page.tsx` | UI unique to the route. Makes the segment publicly reachable. |
| `layout.tsx` | Shared UI that wraps children and **persists** across navigations (no remount). The root layout must render `<html>` and `<body>`. |
| `template.tsx` | Like a layout, but re-mounted on navigation (new key). |
| `loading.tsx` | Instant loading UI. Next.js wraps the page in `<Suspense fallback={<Loading />}>`. |
| `error.tsx` | Error boundary for the segment. Must be `'use client'`. |
| `global-error.tsx` | Error boundary for the root layout. Renders its own `<html>`/`<body>`. |
| `not-found.tsx` | UI shown when `notFound()` is called in the segment, or for unmatched URLs at the root. |
| `default.tsx` | Fallback for a parallel-route slot when Next.js can't recover its active state (on refresh). |
| `route.ts` | Route Handler (`GET`, `POST`, …) built on Web `Request`/`Response`. Can't coexist with `page.tsx` in the same folder. |

### The nesting order
For one segment, Next.js builds this tree:

```tsx
<Layout>
  <Template>
    <ErrorBoundary fallback={<Error />}>
      <Suspense fallback={<Loading />}>
        <NotFoundBoundary fallback={<NotFound />}>
          <Page />
        </NotFoundBoundary>
      </Suspense>
    </ErrorBoundary>
  </Template>
</Layout>
```

In nested routes this whole structure repeats inside the parent's `children`. Two consequences come up a lot in interviews:

- **`error.tsx` doesn't catch its own folder's layout.** The boundary sits *below* the layout. A crash in `app/dashboard/layout.tsx` is caught by `app/error.tsx` (the parent), and a crash in the root layout needs `global-error.tsx`.
- **`loading.tsx` doesn't cover its own folder's layout.** If the layout awaits slow data, the loading fallback can't show for it. Move slow work into the page or wrap it in its own `<Suspense>`.

### Colocation
Because only `page` and `route` files are routable, you can keep `components/`, `utils.ts` or tests inside `app/` next to the route that uses them. For folders you want to keep out of routing entirely, use a private folder (`_components`).

## Follow-ups
- **Can `page.tsx` and `route.ts` live in the same folder?** — No. Both claim the same URL; put the API under a different segment such as `app/api/...`.
- **Why must `error.tsx` be a Client Component?** — React error boundaries are class-component features that run during client rendering and need state to show a fallback and reset.
- **What did the Pages Router use instead?** — `_app` and `_document` for shared wrapping, `404.tsx`/`500.tsx`/`_error` for errors. There was no per-segment layout or loading file.

## Common Mistakes
- Saying a folder is a route by itself. It isn't reachable until it has `page` or `route`.
- Putting an `error.tsx` next to a layout and expecting it to catch that layout's errors.
- Adding `'use client'` to `layout.tsx` "to make it interactive", which pushes the whole subtree's imports into the client bundle. Extract the interactive part instead.

## Tips
- Memorise the order with **"L-T-E-L-N-P"**: Layout, Template, Error, Loading, Not-found, Page.
- Draw the nested JSX tree on the whiteboard. It explains every edge case (why `global-error` exists, why loading doesn't cover the layout) in one picture.
