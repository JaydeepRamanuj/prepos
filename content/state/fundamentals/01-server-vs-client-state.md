---
title: "What is the difference between server state, client state, URL state and form state?"
level: easy
type: concept
tags: [state, server-state, client-state, url-state, forms]
related: [state/why-tanstack-query, state/state-colocation, state/choosing-state-library]
---

## Question
People say "don't put server data in Redux". What kinds of state does a React app have, how are they different, and which tool usually owns each kind?

## Interview Answer
I split state into four kinds by who owns the truth. Server state is data that lives in a database and I only hold a cached copy of it — it can go stale, other users can change it, and it needs fetching, caching, retries and invalidation, so I use TanStack Query or Server Components for it. Client state is UI-only data the browser owns, like whether a modal is open or the current theme; `useState` covers most of it and Zustand covers the shared parts. URL state is anything that should survive a refresh or be shareable — filters, page number, selected tab — and it belongs in search params. Form state is the draft the user is typing before submit, and React Hook Form handles it best. Most "state management" pain comes from putting server data into a client store and then hand-writing a bad cache.

## Explanation
### Classify by owner, not by size

| Kind | Source of truth | Typical examples | Main problems | Usual tool |
|---|---|---|---|---|
| Server state | Backend / DB | user profile, product list, orders | staleness, caching, dedup, refetch, invalidation | TanStack Query, RSC `fetch` |
| Client (UI) state | The browser tab | modal open, sidebar collapsed, theme, cart draft | sharing across components, re-renders | `useState`, Context, Zustand |
| URL state | The address bar | `?q=shoes&page=2&sort=price` | sync with UI, shareable links, back button | `useSearchParams`, `searchParams` prop, nuqs |
| Form state | The user's in-progress input | field values, touched, errors | validation, performance on every keystroke | React Hook Form + Zod |

### Why server state is different
Server state is *borrowed*. The moment you fetch it, it may already be out of date. You need answers to questions client state never asks:

- Two components need the same data — do you fetch twice?
- The user comes back to the tab — should you refetch?
- A mutation succeeded — which cached lists are now wrong?
- The request failed — retry? show stale data?

If you store API responses in Zustand or Redux, you end up writing `isLoading`, `error`, `lastFetched` and invalidation logic yourself for every endpoint. A server-state library already solved that.

### Why URL state matters
If a value should survive refresh, be bookmarkable, or work with the back button, it must live in the URL. A filter stored only in `useState` disappears on refresh and cannot be shared with a teammate.

```tsx
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function SortSelect() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  function setSort(sort: string) {
    const next = new URLSearchParams(params);
    next.set("sort", sort);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <select value={params.get("sort") ?? "new"} onChange={(e) => setSort(e.target.value)}>
      <option value="new">Newest</option>
      <option value="price">Price</option>
    </select>
  );
}
```

### Derived state is not a fifth kind
`total = items.reduce(...)` is computed from other state. Do not store it; compute it during render. Storing derived values is the most common source of "state got out of sync" bugs.

## Follow-ups
- **Where does a shopping cart go?** — If it is per-device and anonymous, client state (often persisted to localStorage). Once the user logs in and the cart must sync across devices, it becomes server state.
- **Is "the current user" server or client state?** — Server state: the server owns it. Cache it with your query library or read it from the session on the server.

## Common Mistakes
- Copying fetched data into a global store "so every component can access it" — you lose caching, refetching and deduplication.
- Keeping filters in `useState`, so refresh and shared links lose them.
- Storing values that can be derived from other state.

## Tips
- Lead with "who owns the truth?" — that single question classifies every piece of state and impresses interviewers more than listing libraries.
