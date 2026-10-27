---
title: "After a mutation, when do you use revalidatePath, revalidateTag, updateTag or refresh?"
level: hard
type: concept
tags: [revalidation, revalidatePath, revalidateTag, updateTag, refresh, server-actions, next-16]
related: [nextjs/how-server-actions-work, nextjs/stale-data-after-mutation, nextjs/optimistic-ui-server-action]
---

## Question
A user edits their profile in a Server Action. Next.js 16 gives you `revalidatePath`, `revalidateTag`, `updateTag` and `refresh`. What does each one do, which would you use here, and what changed about `revalidateTag` in version 16?

## Clues
- Two of these invalidate cached *data*. One only refetches the current *route*.
- Does the user who just made the change need to see it right away, or is "eventually" fine?
- In Next 16 `revalidateTag` takes a second argument. What does that argument control?

## Interview Answer
`refresh()` just re-renders the current route on the server and sends the new RSC payload back. It doesn't touch cached data, so it's right when the page reads uncached data. `revalidatePath('/x')` invalidates everything cached for a route path. `revalidateTag(tag, profile)` marks every cache entry with that tag as stale using stale-while-revalidate: the next reader still gets the old value while a fresh one is fetched in the background. `updateTag(tag)` expires the tag immediately, so the next read, including the re-render that comes back with the action's response, waits for fresh data. That is read-your-own-writes, and it can only be called from Server Actions. For a profile edit the user expects to see their change instantly, so I'd call `updateTag(\`user-${id}\`)`. For a CMS webhook in a Route Handler I'd use `revalidateTag(tag, 'max')`. In Next 16 the single-argument `revalidateTag(tag)` is deprecated; the second argument is a `cacheLife` profile (or `{ expire }`) that sets how long stale content may be served.

## Explanation
### The four tools

| API | Invalidates | Freshness for next read | Where | Re-render in action response? |
|---|---|---|---|---|
| `refresh()` | Nothing cached; refetches current route's RSC payload | Uncached reads rerun | Server Actions only | Yes |
| `revalidatePath(path, type?)` | Cached data for a route path | Fresh on next visit | Server Actions, Route Handlers | Yes (in actions) |
| `revalidateTag(tag, profile)` | Every entry with that tag, across routes | Stale-while-revalidate | Server Actions, Route Handlers | **No** (with a SWR profile) |
| `updateTag(tag)` | Every entry with that tag, across routes | Blocks for fresh data | Server Actions only | Yes |

### Tagging the data first
Tags must be attached where the data is cached:

```ts
// With Cache Components (Next 16)
import { cacheTag, cacheLife } from "next/cache";

export async function getProfile(userId: string) {
  "use cache";
  cacheTag(`user-${userId}`);
  cacheLife("hours");
  return db.user.findUnique({ where: { id: userId }, select: { name: true, bio: true } });
}

// Without Cache Components: tag a fetch
await fetch(url, { next: { tags: [`user-${userId}`] } });
```

### The profile edit, read-your-own-writes

```ts
"use server";

import { updateTag } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export async function updateProfile(formData: FormData) {
  const { userId } = await verifySession();
  await db.user.update({
    where: { id: userId },
    data: { bio: String(formData.get("bio") ?? "") },
  });

  updateTag(`user-${userId}`); // expire now, so the returned render is fresh
}
```

The action's response carries the re-rendered page with the new bio, all in one round trip.

### A webhook, eventual consistency

```ts
// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-secret") !== process.env.REVALIDATE_SECRET) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const { tag } = await req.json();
  revalidateTag(tag, "max"); // readers get stale content while it regenerates
  return Response.json({ ok: true });
}
```

`updateTag` would throw here because it is Server-Actions-only. If a webhook needs data gone immediately, use `revalidateTag(tag, { expire: 0 })`.

### Path vs tag
`revalidatePath('/blog')` refreshes only that route. Another page (`/dashboard`) that shows the same posts under tag `posts` stays stale until the tag is revalidated. Prefer tags when the same data appears on several routes. Use paths when one page is affected and tagging is overkill. To revalidate a dynamic route pattern, pass the type: `revalidatePath('/blog/[slug]', 'page')`. With rewrites, pass the **destination** path.

### `redirect` ordering
`redirect()` throws, so anything after it never runs. Revalidate first:

```ts
updateTag("posts");
redirect(`/posts/${post.id}`);
```

### How this evolved
- **13/14:** `revalidatePath(path)` and `revalidateTag(tag)`. A tag revalidation expired immediately. `router.refresh()` was the client-side way to refetch.
- **15:** same APIs, but `fetch` stopped caching by default, so many apps needed less revalidation.
- **16:** `revalidateTag(tag, profile)` is required (single-arg deprecated and equivalent to `{ expire: 0 }`). `updateTag` and the server-side `refresh()` were added for actions.

## Follow-ups
- **Why doesn't `revalidateTag` with `'max'` show the change in the same response?** — It only marks the entries stale. The action's own re-render reads the stale value by design. That is the trade-off you choose for speed.
- **Does revalidation regenerate every tagged page immediately?** — No. Revalidation happens when a request next reads that data, so pages refresh as they are visited.
- **What about multiple self-hosted instances?** — A tag invalidation on one instance doesn't reach the others unless you use a shared cache handler that coordinates tags (for example, one backed by Redis).

## Common Mistakes
- Calling `revalidateTag('posts')` with one argument in Next 16, which is deprecated.
- Using `updateTag` in a Route Handler, where it throws.
- Calling `revalidatePath` after `redirect()`, so it never runs.
- Using `refresh()` when the data is cached. It reruns dynamic work but leaves cache entries alone, so the stale value comes back.

## Tips
- Frame it as a question: "Does the person who clicked need to see it now?" If yes, use `updateTag`. If eventual is fine, use `revalidateTag(tag, 'max')`.
- Saying "`refresh` is for uncached data, the tag APIs are for cached data" in one line shows the interviewer you have the right mental model.
