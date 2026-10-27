---
title: "What is a Server Action, and what actually happens over the network when one runs?"
level: medium
type: concept
tags: [server-actions, use-server, forms, progressive-enhancement, rsc-payload]
related: [nextjs/server-actions-are-public-endpoints, nextjs/form-with-use-action-state, nextjs/revalidate-after-mutation, react/use-action-state]
---

## Question
Explain Server Actions. How do you define one, how is it called from the client, what does the network request look like, and what does "progressive enhancement" mean here?

## Interview Answer
A Server Action is an async function marked with `'use server'` that runs on the server but can be called from the client like a normal function. At build time the compiler replaces the function in the client bundle with a reference, an encrypted action ID plus a small dispatcher, so calling it sends a `POST` to the current page with the serialized arguments. On the server Next.js looks up the ID, runs the function and replies in one response that carries the return value and, if the action revalidated, redirected or set cookies, the re-rendered RSC payload for the page. Passed to `<form action>`, it gets the `FormData` automatically and works before JavaScript loads, because the server renders a real HTML form that can submit natively. That is progressive enhancement. Once hydrated, React intercepts the submit and does it without a page reload.

## Explanation
### Defining one
Two placements of the directive:

```ts
// app/posts/actions.ts — every export in this file is a Server Action
"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export async function createPost(formData: FormData) {
  const { userId } = await verifySession();
  const title = String(formData.get("title") ?? "");
  await db.post.create({ data: { title, authorId: userId } });
  revalidatePath("/posts");
}
```

```tsx
// Inline inside a Server Component
export default function Page() {
  async function archive(formData: FormData) {
    "use server";
    // ...
  }
  return <form action={archive}>{/* ... */}</form>;
}
```

Client Components can't *define* actions, but they can import them from a `'use server'` file or receive them as props.

### What happens on submit

```txt
Browser                                    Next.js server
───────                                    ──────────────
<form action={createPost}> submit
  │  POST /posts                           
  │  header: Next-Action: <action-id>      
  │  body: FormData / serialized args  ──▶ check Origin vs Host (CSRF)
  │                                         find action by ID, run it
  │                                         revalidatePath('/posts')
  │                                         re-render current route
  │  ◀── one response: return value + new RSC payload
  ▼
React commits the new UI (no full reload)
```

Key properties:
- **Always `POST`.** Only POST can invoke an action, which limits accidental side effects from GET requests and helps against CSRF.
- **Single round trip.** If the action calls `revalidatePath`, `updateTag`, `refresh()`, sets/deletes cookies, or `redirect`s, the fresh UI comes back in the same response. No follow-up fetch.
- **Dispatched one at a time per client.** If the user fires three actions quickly, they queue. Don't use actions for parallel data fetching.
- **Arguments and return values are serialized** with the RSC protocol, so they must be serializable (no class instances, no functions).

### Ways to invoke

```tsx
"use client";
import { useTransition } from "react";
import { createPost, likePost } from "./actions";

export function Examples({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {/* 1. Form action: receives FormData, progressively enhanced */}
      <form action={createPost}>
        <input name="title" />
        <button>Create</button>
      </form>

      {/* 2. Event handler: call it like a function inside a transition */}
      <button
        disabled={isPending}
        onClick={() => startTransition(() => likePost(postId))}
      >
        Like
      </button>
    </>
  );
}
```

Extra arguments can be bound: `updateUser.bind(null, userId)` gives an action whose first parameter is `userId` and whose second is the `FormData`. Bound arguments are serialized into the request and controlled by the client, so the server must still check them.

### Progressive enhancement, precisely
- **In a Server Component form:** the form submits even if JS is disabled or not loaded yet. The server runs the action and returns a full page.
- **In a Client Component form:** submissions made before hydration are queued and replayed once React hydrates.
- After hydration the browser doesn't navigate. React handles the response.

### History
- **Next 13.4:** introduced behind `experimental.serverActions`.
- **Next 14:** stable and on by default.
- **React 19 / Next 15:** `useFormState` was renamed `useActionState` (now from `react`, and it returns a `pending` flag).
- **Next 16:** `updateTag` and `refresh` were added for use inside actions.

## Follow-ups
- **Where does the "Failed to find Server Action" error come from?** — The client is running an old build whose action IDs no longer exist on the new deployment (version skew). Use rolling deploys, a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across instances, and a retry path in the UI.
- **Can a Server Action return data?** — Yes, any serializable value. But return only what the UI needs, never raw DB rows.
- **Is there a body size limit?** — 1 MB by default, configurable via `serverActions.bodySizeLimit`.

## Common Mistakes
- Thinking the function is "private" because it isn't exposed as a route. It is a public POST endpoint.
- Using Server Actions to *read* data from a Client Component. They queue, and they are meant for mutations. Fetch in Server Components or use a Route Handler.
- Calling `redirect()` inside a `try/catch`. `redirect` throws a control-flow error, so it must be outside the `try`.

## Tips
- Explain the compile-time swap (function becomes a reference that POSTs). It shows you understand the mechanism, not just the syntax.
- Remember the four things that make an action ship fresh UI in the same response: **revalidate, refresh, cookies, redirect.**
