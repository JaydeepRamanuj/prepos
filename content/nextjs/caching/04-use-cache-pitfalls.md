---
title: "Debug these 'use cache' mistakes: leaking data, never-hitting cache and errors"
level: hard
type: debugging
tags: [use-cache, debugging, cache-keys, cookies, serialization, cacheTag]
related: [nextjs/use-cache-and-cache-life, nextjs/cache-tag-and-invalidation, nextjs/dashboard-partial-personalization, nextjs/stale-data-after-mutation]
---

## Question
Find the problem in each snippet.

```tsx
// A
async function Profile() {
  "use cache";
  const session = (await cookies()).get("session")?.value;
  return <UserCard data={await getUser(session)} />;
}

// B
async function getReport(user: User) {          // User is a class instance
  "use cache";
  cacheLife("hours");
  return buildReport(user);
}

// C
export async function getPosts() {
  "use cache";
  cacheTag("posts");
  return db.post.findMany();
}
export async function createPost(fd: FormData) {
  "use server";
  await db.post.create({ data: parse(fd) });
  revalidateTag("post");
}

// D
async function getPrice(sku: string) {
  "use cache";
  cacheLife("hours");
  return { price: await fetchPrice(sku), at: Date.now() };
}

// E
async function Feed({ userId }: { userId: string }) {
  "use cache";
  cacheLife("days");
  return <List items={await getFeed(userId)} />;
}
```

## Clues
- Which of these reads request-specific data inside a cached scope?
- Check strings used as tags, and whether the call signature matches the 16 API.
- Consider cache cardinality and what is shared between users.

## Interview Answer
A reads `cookies()` inside a `"use cache"` scope, which throws; the cookie must be read outside and passed as an argument, or `use cache: private` used, and note that keying by a unique session value gives no sharing. B passes a class instance, which isn't serialisable, so convert to a plain object or pass an id. C tags data `posts` but revalidates `post`, so invalidation never hits; also in Next.js 16 `revalidateTag` takes a profile as the second argument, or the action should use `updateTag("posts")` for read-your-writes. D returns `Date.now()` inside a cached function, so the timestamp is frozen at the first call, which may be intended but usually isn't. E caches per user id with a long lifetime, which gives low hit rates and many entries; if the feed is personal that's correct but wasteful, and if it should be shared, key it by segment instead.

## Explanation
### A: runtime API in a cached scope

```tsx
// Fix: read outside, pass the value in
async function Profile() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return <LoginPrompt />;
  return <CachedProfile session={session} />;       // wrapped in Suspense by the parent
}

async function CachedProfile({ session }: { session: string }) {
  "use cache";
  cacheLife("minutes");
  return <UserCard data={await getUser(session)} />;
}
```

Because `session` is part of the key, entries aren't shared between users. Prefer user ids with auth checks done in the data layer, and keep personal data out of shared caches.

### B: non-serialisable argument

```tsx
async function getReport(userId: string) {
  "use cache";
  cacheLife("hours");
  const user = await getUser(userId);
  return buildReport(user);
}
```

### C: tag mismatch and API shape

```tsx
export async function createPost(fd: FormData) {
  "use server";
  await db.post.create({ data: parse(fd) });
  updateTag("posts");              // immediate: author sees their post (Server Actions only)
  // or: revalidateTag("posts", "max");   // stale-while-revalidate, also works in Route Handlers
}
```

Tags are exact strings; centralise them in constants or helpers (`tags.posts`).

### D: time and randomness inside cached code
`Date.now()` captures the time of computation, not of each request. If that's the intent ("price as of"), fine; otherwise compute per request outside the cache. Also, `Math.random()` inside a cached function gives one value for all users until revalidation.

### E: cardinality and sharing
Every distinct `userId` is its own entry. For personal data with low reuse, caching adds memory and invalidation complexity for little gain; the in-memory cache may also not persist in serverless. Cache shared data (catalogue, plan-based pricing), stream personal data fresh.

### Other classic bugs
- Forgetting `cacheLife`, so the default 15-minute revalidate surprises you.
- Cache key explosion by passing large objects or unbounded strings (search queries).
- Passing a function or `Date` subclass as an argument.
- Expecting entries to survive redeploys (key includes build id).
- Testing in `next dev`, where caching differs from production.
- Using `unstable_cache` and `use cache` interchangeably in one codebase without understanding which model is active.

### Checklist for reviewing cached code
1. No runtime APIs inside.
2. Arguments serialisable and low cardinality.
3. Explicit `cacheLife`.
4. Tags are correct strings and invalidated by the right API.
5. No per-user data in shared entries.
6. Time/random values handled deliberately.

## Follow-ups
- **What error does A produce?** — A Next.js error that request-time APIs can't be used inside `use cache` (`next-request-in-use-cache`).
- **How do you inspect hits?** — Log timings or counters inside the function body; a hit doesn't run it.

## Common Mistakes
- Treating `use cache` like memoisation without cache-key thinking.
- Wrong tag names.
- Using a single-argument `revalidateTag` in 16.

## Tips
- Go through the review checklist aloud; it shows a systematic approach.
