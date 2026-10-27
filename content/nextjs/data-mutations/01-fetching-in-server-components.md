---
title: "How do you fetch data in a Server Component, and how is that different from getServerSideProps or useEffect?"
level: easy
type: concept
tags: [server-components, data-fetching, fetch, react-cache, app-router]
related: [nextjs/avoid-data-waterfalls, nextjs/route-handlers-vs-server-actions, nextjs/data-access-layer]
---

## Question
In the App Router, how do you fetch data for a page? Show the code, and explain how it differs from `getServerSideProps` in the Pages Router and from fetching in `useEffect`.

## Interview Answer
In the App Router a page is a Server Component by default, so I make the component `async` and `await` the data right inside it, with `fetch`, an ORM or a direct database query. The code runs only on the server, so credentials and query logic never reach the client bundle, and the browser receives rendered HTML plus the RSC payload, not a JSON blob it has to render itself. Compared with `getServerSideProps`, there is no special page-level export: any Server Component in the tree can fetch what it needs, and identical `fetch` calls are memoized for the request, so I can fetch where the data is used instead of drilling props. Compared with `useEffect`, there is no loading waterfall after hydration and no client JS for the fetching. For non-`fetch` sources I wrap the function in `React.cache` to get the same per-request dedupe.

## Explanation
### The basic shape

```tsx
// app/blog/page.tsx — a Server Component (no "use client")
import { db } from "@/lib/db";

export default async function BlogPage() {
  const posts = await db.post.findMany({ select: { id: true, title: true } });

  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  );
}
```

That is the whole API: an `async` component and `await`. Dynamic route params are a **Promise** since Next.js 15, so you `await` them too:

```tsx
// app/blog/[slug]/page.tsx
export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  return <h1>{post.title}</h1>;
}
```

### Compared with the alternatives

| | `getServerSideProps` (Pages Router) | `useEffect` in a client component | async Server Component |
|---|---|---|---|
| Where it runs | Server, once per page | Browser, after hydration | Server, any component in the tree |
| Granularity | Whole page | Per component | Per component |
| JS shipped for fetching | None, but the page component hydrates | Fetch code + loading state | None |
| Secrets safe? | Yes | No | Yes |
| First paint has data? | Yes (blocks the whole page) | No (spinner first) | Yes, and you can stream parts with `<Suspense>` |

### Deduplication: fetch where you need it
Two components that call the same `fetch` URL with the same options during one render share a single request (request memoization). For database calls, wrap the function in `React.cache`:

```ts
// lib/data.ts
import { cache } from "react";
import { db } from "@/lib/db";

export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});
```

Now the layout, the page and `generateMetadata` can all call `getUser(id)`, and the query runs once per request. `React.cache` is scoped to one request. It is not a cross-request cache.

### Caching is separate (and changed across versions)
- **Next 13/14:** `fetch` was cached by default (`force-cache`). Many people were surprised by stale data.
- **Next 15:** `fetch` is **not** cached by default. You opt in with `cache: 'force-cache'` or `next: { revalidate }`.
- **Next 16 with Cache Components:** you cache with the `'use cache'` directive and stream uncached reads behind `<Suspense>`. See the caching chapter for the details.

### Do not fetch your own Route Handler
A Server Component should call the data source directly, not `fetch('/api/posts')`. Calling your own API adds an HTTP round trip, and at build time there is no server listening, so prerendering fails.

## Follow-ups
- **When would you still fetch on the client?** — For data that depends on browser-only APIs (geolocation, storage), for frequent polling, or for highly interactive client state. Use TanStack Query or SWR there.
- **Can a Client Component receive server data without fetching itself?** — Yes. Start the fetch in a Server Component, pass the promise as a prop, and unwrap it with React's `use()` inside `<Suspense>`.
- **What does an uncaught throw in the fetch do?** — It bubbles to the nearest `error.tsx` boundary for that segment.

## Common Mistakes
- Writing `useEffect` + `useState` fetching in a page that could have been a Server Component.
- Calling `fetch("http://localhost:3000/api/...")` from a Server Component.
- Forgetting that `params` and `searchParams` are Promises in Next 15+ and reading `params.slug` directly.
- Assuming `React.cache` persists across requests.

## Tips
- Open with "pages are Server Components, so I just make them async and await". Then add one sentence each on memoization and on what changed with caching in 15.
- If they ask about Pages Router experience, map it directly: `getServerSideProps` becomes an async page, `getStaticPaths` becomes `generateStaticParams`.
