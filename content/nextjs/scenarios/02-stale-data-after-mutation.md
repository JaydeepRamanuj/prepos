---
title: "Users edit their profile but still see the old name until a hard refresh"
level: hard
type: scenario
tags: [stale-data, revalidation, server-actions, router-cache, updateTag, debugging]
related: [nextjs/revalidate-after-mutation, nextjs/cache-tag-and-invalidation, nextjs/prefetching-and-router-cache, nextjs/caching-layers-overview]
---

## Question
Support reports that after editing their display name, users still see the old one in the header and on the profile page until they refresh. The edit is a Server Action that writes to the database. How do you debug it and what are the likely fixes?

## Clues
- Identify every place where the name is read and which cache layer might hold it.
- Check how the mutation happens: Server Action vs client `fetch`.
- Check that the invalidation targets the same tag/path used by the cached read.

## Interview Answer
I'd bisect the cache layers. First, reproduce in a production build, because dev doesn't cache like prod. Then ask: did the write succeed (check the DB)? Did the page response after the action contain fresh data (Network tab: the action response includes the new RSC payload when revalidated properly)? Likely causes: the Server Action never invalidates the cached data (missing `updateTag`/`revalidateTag`/`revalidatePath`), it invalidates a different tag or path than the read uses, it uses `revalidateTag` with stale-while-revalidate so the immediate re-render still gets the old value (use `updateTag` for read-your-own-writes), the mutation is done by a client `fetch` to an API route so the client router cache isn't invalidated (use a Server Action or call `router.refresh()`), the header reads from a layout that doesn't re-render on navigation, or the data is also held in client state initialised from props and never updated. The fix is to tag the read, call `updateTag` in the action, and make client state derive from props (or key it).

## Explanation
### Where the name can be cached

| Layer | Symptom | Fix |
|---|---|---|
| Server data cache (`use cache`, `fetch` cache, `unstable_cache`) | page re-renders but with old value | invalidate with the correct tag/path |
| Prerendered shell / ISR output | new visits show old content for a while | tag revalidation; time-based safety net |
| Client router cache | in-app navigation shows old RSC payload | mutation via Server Action (auto-invalidates), `router.refresh()`, or shorter `stale` |
| Layout not re-rendering | header stays old | read user data in a component that re-renders or revalidate the layout path (`revalidatePath('/', 'layout')`) |
| Client state copy | UI shows old value after props change | derive from props, or reset with `key` |
| CDN / browser HTTP cache | stale HTML | check `Cache-Control`; `private` for personalised pages |

### Debug steps
1. Production build locally: `next build && next start`.
2. Network tab: the Server Action POST response; does it include an updated RSC payload? A refreshed payload indicates correct invalidation in the action.
3. Hit the page in a private window; if fresh, it's a client cache or state issue; if stale, a server cache.
4. Log in the data function to see whether it ran after the mutation.
5. Verify tag strings and path arguments match exactly.

### Typical fix

```ts
// data
export async function getUserName(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user-${id}`);
  return (await db.user.findUnique({ where: { id } }))?.name;
}

// action
"use server";
export async function updateName(fd: FormData) {
  const { userId } = await verifySession();
  const name = schema.parse(fd.get("name"));
  await db.user.update({ where: { id: userId }, data: { name } });
  updateTag(`user-${userId}`);                // expire now; the re-render in this response waits for fresh data
}
```

If the name is shown in a layout and in pages, both read through the same tagged function, so one invalidation updates both.

### Common wrong turns

```ts
revalidateTag("user");            // wrong tag (tags are exact) and, in 16, missing the profile argument
revalidateTag(`user-${id}`, "max"); // SWR: the immediate re-render may still show the old value
router.push("/profile");          // doesn't refresh stale cache entries by itself
```

When the mutation is a client-side `fetch("/api/profile", { method: "PATCH" })`, nothing tells Next.js to refresh. Either move to a Server Action, or follow the request with `router.refresh()`, plus `revalidateTag` in the API route for server caches.

### Client state pitfalls

```tsx
const [name, setName] = useState(props.name);   // initialised once; later props changes ignored
```

Derive from props, or `key={props.name}`/lift to a store updated from the action result.

### Preventing recurrence
- Centralise tags in a module; test that each mutation invalidates the tags its reads use.
- Add an e2e test: change the name, navigate without reload, assert the new value in the header and page.
- Prefer `updateTag` for user-initiated edits and `revalidateTag(..., "max")` for background updates.

## Follow-ups
- **Why does a hard refresh fix it?** — A reload clears the client router cache and re-requests the document, hitting the server cache (which was invalidated or has expired).
- **Is `revalidatePath("/profile")` enough?** — Only for entries cached under that path; tagged data shared across routes needs its tag invalidated.

## Common Mistakes
- Testing in dev mode.
- Mixing up tags/paths or forgetting the new `revalidateTag` signature.
- Mutating via client fetch and expecting a refresh.

## Tips
- Walk the layers in order and say what evidence each step gives.
