---
title: "Build a product listing with search, filters, sort and URL-synced state"
level: advanced
type: implement
tags: [filters, url-state, searchParams, debounce, derived-state, nextjs, e-commerce]
related: [machine-coding/data-table, machine-coding/autocomplete-typeahead, nextjs/search-params-url-state]
---

## Question
Build an e-commerce style product listing page.

**Must-haves**
- Text search, category checkboxes, a price range and a sort dropdown.
- The URL reflects the filters so the page is shareable and the back button works.
- Result count and a "Clear filters" action.
- Loading, empty and error states.
- Rapid filter changes never show stale results.

**Stretch goals**
- Pagination or infinite scroll in the same URL model.
- Debounced search input.
- Filter counts per category.

## Clues
- Treat the URL as the single source of truth for filters; derive the UI from `useSearchParams` and update with `router.replace`/`push`.
- Keep the text input as local state for immediate typing, and write it to the URL after a debounce.
- Build the data request from the same parsed filter object, and include it in the query key so caching and cancellation work.

## Interview Answer
I make the URL the state: a `parseFilters(searchParams)` function turns it into a typed object `{ q, categories, min, max, sort, page }` with defaults and validation, and `toSearchParams(filters)` serialises it back. Controls read from the parsed object and update by building a new query string and calling `router.replace` (for typing) or `push` (for discrete changes). The search input keeps a local draft so typing is instant and flushes to the URL after about 300ms. Data fetching is keyed by the parsed filters, ideally via TanStack Query with `placeholderData: keepPreviousData` so the old list stays visible while the new one loads, and abort or key-based dedupe prevents stale responses. Changing any filter resets `page` to 1. On Next.js the page can be a Server Component that reads `searchParams` and fetches on the server, with a small client component for the controls, which gives shareable, indexable, fast first loads.

## Explanation
### URL as state

```txt
/products?q=shoes&cat=running&cat=casual&min=500&max=3000&sort=price-asc&page=2
```

```ts
type Filters = { q: string; categories: string[]; min: number | null; max: number | null; sort: "relevance" | "price-asc" | "price-desc"; page: number };

const SORTS = ["relevance", "price-asc", "price-desc"] as const;

export function parseFilters(sp: URLSearchParams): Filters {
  const num = (v: string | null) => (v !== null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
  const sort = sp.get("sort");
  return {
    q: sp.get("q") ?? "",
    categories: sp.getAll("cat"),
    min: num(sp.get("min")),
    max: num(sp.get("max")),
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Filters["sort"]) : "relevance",
    page: Math.max(1, num(sp.get("page")) ?? 1),
  };
}

export function toSearchParams(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  f.categories.forEach((c) => sp.append("cat", c));
  if (f.min !== null) sp.set("min", String(f.min));
  if (f.max !== null) sp.set("max", String(f.max));
  if (f.sort !== "relevance") sp.set("sort", f.sort);          // omit defaults to keep URLs clean
  if (f.page > 1) sp.set("page", String(f.page));
  return sp;
}
```

### Client controls

```tsx
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function Filters({ allCategories }: { allCategories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseFilters(new URLSearchParams(searchParams));

  const [draft, setDraft] = useState(filters.q);
  useEffect(() => setDraft(filters.q), [filters.q]);            // back/forward updates the input

  function update(patch: Partial<Filters>, mode: "push" | "replace" = "push") {
    const next = toSearchParams({ ...filters, page: 1, ...patch });   // any filter change resets the page
    router[mode](`${pathname}?${next}`, { scroll: false });
  }

  // Debounce text into the URL
  useEffect(() => {
    if (draft === filters.q) return;
    const t = setTimeout(() => update({ q: draft }, "replace"), 300);
    return () => clearTimeout(t);
  }, [draft]);   // eslint-disable-line -- update/filters intentionally read at fire time

  return (
    <form role="search">
      <input type="search" aria-label="Search products" value={draft} onChange={(e) => setDraft(e.target.value)} />

      {allCategories.map((c) => (
        <label key={c}>
          <input
            type="checkbox"
            checked={filters.categories.includes(c)}
            onChange={(e) =>
              update({ categories: e.target.checked ? [...filters.categories, c] : filters.categories.filter((x) => x !== c) })
            }
          />
          {c}
        </label>
      ))}

      <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as Filters["sort"] })}>
        <option value="relevance">Relevance</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>

      <button type="button" onClick={() => router.push(pathname)}>Clear filters</button>
    </form>
  );
}
```

(`useSearchParams` in a statically rendered page needs a `<Suspense>` boundary around the component. Check the bundled Next.js docs for the current rules.)

### Data side
Server Component page:

```tsx
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) [v].flat().forEach((x) => sp.append(k, x));
  const filters = parseFilters(sp);
  const { items, total } = await getProducts(filters);     // filter, sort, paginate on the server/DB
  return (<><Filters allCategories={await getCategories()} /><ProductGrid items={items} total={total} /></>);
}
```

In Next.js 16, `searchParams` is a Promise and must be awaited. For a purely client-side version, use `useQuery({ queryKey: ["products", filters], queryFn: ({ signal }) => fetchProducts(filters, signal), placeholderData: keepPreviousData })`.

### Design decisions
- **`replace` vs `push`:** typing uses `replace` so each keystroke does not add a history entry; discrete toggles use `push` so Back undoes them.
- **Validation:** never trust the URL; coerce and clamp values, and ignore unknown categories.
- **Race conditions:** query keys plus abort signals, or on the server, each navigation is a fresh render.
- **Performance:** filter in the database with indexes; for small static catalogues filter client-side with `useMemo`.
- **UX:** keep previous results visible while loading, show active filter chips, and restore scroll on Back.
- **SEO:** server-rendered, crawlable URLs for important facets; `noindex` for combinatorial junk.

## Follow-ups
- **Why not keep filters in `useState`?** — They vanish on refresh, can't be shared, and break Back; the URL gives all three for free.
- **Where do you store the sort when the user has a saved preference?** — Default from the preference, but an explicit URL value wins.

## Common Mistakes
- Pushing a history entry per keystroke.
- Not resetting the page when filters change.
- Parsing the URL in many places instead of one `parseFilters`.

## Tips
- Frame it as "URL in, UI out": parse once, serialise once.
