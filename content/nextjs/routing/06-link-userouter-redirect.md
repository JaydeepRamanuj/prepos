---
title: "Link vs useRouter vs redirect(): which navigation API do you use where?"
level: medium
type: concept
tags: [link, use-router, redirect, navigation, prefetching]
related: [nextjs/loading-error-not-found, nextjs/prefetching-and-router-cache, nextjs/server-actions-basics]
---

## Question
Next.js gives you `<Link>`, `useRouter()` from `next/navigation`, and `redirect()`. When do you use each? What does `<Link>` do that a plain `<a>` doesn't? And what's wrong with this Server Action?

```ts
'use server'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  try {
    const post = await db.post.create({ data: { title: String(formData.get('title')) } })
    redirect(`/posts/${post.id}`)
  } catch (err) {
    return { error: 'Could not create post' }
  }
}
```

## Interview Answer
`<Link>` is the default for anything the user clicks to navigate. It renders a real `<a>`, so you keep accessibility, SEO, middle-click and open-in-new-tab, and it adds a client-side transition that keeps shared layouts mounted, plus automatic prefetching when the link enters the viewport in production. `useRouter()` is for imperative navigation in Client Components after some logic runs, for example `router.push` after a client-side check, `router.back()` to close a modal, or `router.refresh()` to re-fetch Server Components for the current route. `redirect()` is for the server side: a Server Component, Route Handler or Server Action that decides during rendering or a mutation that the user belongs somewhere else. The bug in the snippet is that `redirect()` works by throwing a special `NEXT_REDIRECT` error, so the `catch` swallows it and the action returns an error even though the post was created. Call `redirect` outside the `try` block.

## Explanation
### Choosing the API

| Need | Use | Where it runs |
|---|---|---|
| User clicks to go somewhere | `<Link href>` | Server or Client Component (it's a Client Component internally) |
| Navigate after client logic, close a modal | `useRouter().push/replace/back` | Client Components only |
| Re-render current route with fresh server data | `router.refresh()` | Client |
| Decide during render or a mutation to send the user elsewhere | `redirect()` / `permanentRedirect()` | Server Components, Route Handlers, Server Actions (and Client Component render, not event handlers) |
| Redirect before rendering at all (auth gate, legacy URLs) | `proxy.ts` or `redirects()` in `next.config` | Before the route renders |

### What `<Link>` adds over `<a>`
- **Client-side transition.** It fetches only the RSC payload for the changed segments, keeps shared layouts and their state, and doesn't reload the page.
- **Prefetching.** In production, when the link enters the viewport, Next.js prefetches the route: the full route for static routes, and down to the nearest `loading.tsx` for dynamic ones. With Partial Prefetching it prefetches the per-route App Shell. `prefetch={false}` turns it off, and `prefetch={true}` prefetches more.
- **Scroll management.** It scrolls to the top on navigation; `scroll={false}` opts out.
- **`replace`** swaps the history entry instead of pushing a new one.

Use `useLinkStatus()` (15.3+) inside a link to show a pending indicator on slow networks.

### The `useRouter` gotchas

```tsx
'use client'
import { useRouter } from 'next/navigation' // NOT 'next/router' (Pages Router)

export function SaveButton() {
  const router = useRouter()
  return <button onClick={async () => { await save(); router.push('/done') }}>Save</button>
}
```

- The App Router hook has no `pathname`, `query` or `events`. Use `usePathname()` and `useSearchParams()` instead.
- `router.refresh()` clears the client cache for the current route and re-renders Server Components, but it does **not** invalidate server-side caches. For that you need `revalidatePath`/`revalidateTag`/`updateTag`.
- Never pass untrusted URLs to `push`/`replace`, because a `javascript:` URL would execute.

### The fix for the snippet

```ts
'use server'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  let id: string
  try {
    const post = await db.post.create({ data: { title: String(formData.get('title')) } })
    id = post.id
  } catch {
    return { error: 'Could not create post' }
  }
  redirect(`/posts/${id}`) // throws NEXT_REDIRECT, outside the try
}
```

`notFound()` throws in the same way. If you must catch broadly, re-throw framework errors with `unstable_rethrow(err)`.

### Status codes
- `redirect()` gives a 307 (temporary). In a Server Action, it performs a client navigation, or a 303 for a no-JS form post.
- `permanentRedirect()` gives a 308.
- During streaming the headers are already sent, so a redirect becomes a client-side redirect injected into the HTML.
- In a Server Action, `redirect` defaults to `push` (adds a history entry); elsewhere it defaults to `replace`.

## Follow-ups
- **Can you call `redirect()` in an `onClick`?** — No. In Client Components it works only during render. Use `router.push` in event handlers.
- **Why is prefetching disabled in development?** — Prefetching runs only in production, so dev navigation can feel slower than prod. Test with `next build && next start`.
- **How would you prefetch only on hover?** — Wrap `Link` and switch `prefetch` from `false` to `null` (or to `true`/`'auto'` with Partial Prefetching) in `onMouseEnter`, or call `router.prefetch(href)`.

## Common Mistakes
- Importing `useRouter` from `next/router` in the App Router.
- Using `onClick={() => router.push(...)}` on a `<div>` instead of a `<Link>`. You lose accessibility, open-in-new-tab and prefetching.
- Wrapping `redirect`/`notFound` in `try/catch`.
- Expecting `router.refresh()` to bust `use cache` or `fetch` caches on the server.

## Tips
- Rule of thumb to say out loud: **Link for clicks, router for client logic, redirect for server decisions, proxy for before-render.**
- The "redirect throws" detail is a favourite debugging question. Explain why it throws: it has to unwind rendering from any depth, just like `notFound()`.
