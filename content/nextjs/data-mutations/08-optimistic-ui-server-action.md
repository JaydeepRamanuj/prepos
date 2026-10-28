---
title: "Optimistic UI with Server Actions: like button with rollback and revalidation"
level: hard
type: implement
tags: [useOptimistic, server-actions, optimistic-ui, updateTag, rollback]
related: [react/use-optimistic, nextjs/revalidate-after-mutation, nextjs/server-action-error-handling, nextjs/how-server-actions-work]
---

## Question
Build a like button for a post in the App Router. Clicking should update the count instantly, call a Server Action, roll back and show an error if it fails, and make sure the page shows the real count after success.

## Clues
- The optimistic state exists only while the Action is running.
- The server must be the source of truth: revalidate the data that displays the count.
- The Server Action must authenticate and handle duplicates.

## Interview Answer
The like button is a Client Component that receives the current `liked` and `count` from a Server Component. It uses `useOptimistic` to apply the toggle immediately, and it calls a Server Action inside a transition (a form action or `startTransition`). The action authenticates the user, writes idempotently, and invalidates the data for the post with `updateTag`, so the re-render that comes back in the same response contains the real count; when the transition ends the optimistic layer is dropped and replaced by the server's value. If the action returns an error or throws, the real props never change, so the UI rolls back automatically, and I show an error message from returned state. I also make the toggle idempotent on the server (set liked state rather than increment) so double clicks or retries don't drift.

## Explanation
### Server Action

```ts
// app/posts/actions.ts
"use server";
import { updateTag } from "next/cache";
import { getSessionUser } from "@/lib/dal";

export async function setLike(postId: string, liked: boolean) {
  const user = await getSessionUser();                    // authenticate every call
  if (!user) return { ok: false as const, error: "Please sign in" };

  try {
    if (liked) {
      await db.like.upsert({ where: { postId_userId: { postId, userId: user.id } }, create: { postId, userId: user.id }, update: {} });
    } else {
      await db.like.deleteMany({ where: { postId, userId: user.id } });
    }
  } catch {
    return { ok: false as const, error: "Couldn't save your like" };
  }

  updateTag(`post-${postId}`);                            // read-your-writes: re-render has fresh count
  return { ok: true as const };
}
```

`liked` is the desired state, so retries are idempotent.

### Data function (tagged)

```ts
export async function getPostLikes(postId: string, userId: string | null) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`post-${postId}`);
  /* count shared across users; "liked by me" fetched separately without caching */
  return db.like.count({ where: { postId } });
}
```

(The per-user `liked` flag comes from an uncached, authenticated query so the shared cache isn't polluted with user-specific data.)

### Client Component

```tsx
"use client";
import { useOptimistic, useState, useTransition } from "react";
import { setLike } from "./actions";

export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const [optimistic, setOptimistic] = useOptimistic(
    { liked, count },
    (state, nextLiked: boolean) => ({
      liked: nextLiked,
      count: state.count + (nextLiked ? 1 : -1),
    })
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic.liked;
    startTransition(async () => {
      setError(null);
      setOptimistic(next);                                // instant UI
      const res = await setLike(postId, next);
      if (!res.ok) setError(res.error);                   // props unchanged -> automatic rollback
    });
  }

  return (
    <>
      <button onClick={toggle} aria-pressed={optimistic.liked}>
        {optimistic.liked ? "♥" : "♡"} {optimistic.count}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
```

### Flow

```txt
click -> setOptimistic(next) -> UI updates immediately
      -> setLike() POST (transition pending)
      -> server writes, updateTag -> response contains fresh RSC payload
      -> transition ends -> optimistic layer dropped -> props now show real values
failure -> props unchanged -> UI snaps back; error message shown
```

### Details and pitfalls
- Optimistic updates must be applied inside the transition (before the first `await`). State updates made after an `await` in an async transition are not automatically part of the transition; wrap them in another `startTransition` if they should be treated as non-urgent. Setting a plain error message afterwards is fine as an urgent update.
- Rapid clicks: the transition queue serialises actions; because the action sets a desired state (not a toggle), the final state is right.
- `revalidatePath` also works; `updateTag` is more precise for tagged data.
- Do not trust the client's `count`; compute it on the server.
- For lists (add item), include a temporary client id and replace it when the server data arrives.
- Accessibility: `aria-pressed`, and announce failures with `role="alert"`.

## Follow-ups
- **What if the server data is cached and I use `revalidateTag` instead?** — With stale-while-revalidate the response may contain the old count; use `updateTag` for read-your-writes.
- **Is `useOptimistic` required?** — No, but it removes the manual rollback logic.

## Common Mistakes
- Toggling instead of setting state on the server.
- Forgetting authentication in the action.
- Not invalidating the cached count, so the UI snaps back to stale data.

## Tips
- Emphasise idempotency and the automatic rollback property.
