---
title: "Build a data table with sorting, filtering and pagination"
level: hard
type: implement
tags: [data-table, sorting, filtering, pagination, useMemo, a11y]
related: [machine-coding/infinite-scroll, machine-coding/autocomplete-typeahead, react/usememo-usecallback]
---

## Question
Build a `DataTable` that displays rows with column headers.

**Must-haves**
- Click a header to sort ascending, then descending, then unsorted.
- A text filter that matches any column.
- Pagination with a page-size selector and Prev/Next.
- Changing the filter resets to page 1.
- Show an empty state.

**Stretch goals**
- Sorting that handles numbers, dates and strings correctly.
- Sticky header and keyboard-accessible sort buttons with `aria-sort`.
- Server-side mode (sort/filter/page sent to the API).

```tsx
<DataTable columns={[{ key: "name", label: "Name" }, { key: "age", label: "Age" }]} rows={users} />
```

## Clues
- Derive the visible rows with a pipeline: filter, then sort, then slice. Never store the derived arrays in state.
- Sort a copy (`[...rows].sort(...)`); `Array.prototype.sort` mutates.
- Store only `sort`, `filter`, `page` and `pageSize` as state.

## Interview Answer
State is minimal: the filter string, the sort (`{ key, dir } | null`), the page and the page size. Everything displayed is derived in a `useMemo` pipeline: filter rows where any column's string value includes the query, sort a copy using a comparator that handles numbers and strings (and puts nulls last), then compute `totalPages` and slice the current page. Clicking a header cycles asc, desc, none and sets `aria-sort` on the `th`. Any change to filter or page size resets the page to 1, and the page is clamped so deleting rows cannot leave the user on a non-existent page. The header controls are real buttons so they work with the keyboard. If the dataset is large or lives on the server, the same state is sent as query parameters and the pipeline moves to the backend, with the table just rendering what comes back.

## Explanation
### Derived data pipeline
```txt
rows → filter(query) → sort(key, dir) → paginate(page, size) → render
state:  query, sort, page, pageSize   (rows come from props)
```

### Code

```tsx
import { useMemo, useState } from "react";

type Column<T> = { key: keyof T & string; label: string };
type Sort<T> = { key: keyof T & string; dir: "asc" | "desc" } | null;

function compare(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;            // nulls last
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function DataTable<T extends Record<string, unknown>>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort<T>>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)));
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => dir * compare(a[sort.key], b[sort.key]));
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: keyof T & string) {
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  }

  return (
    <div>
      <input
        aria-label="Filter rows"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
      />
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                <button onClick={() => toggleSort(c.key)}>
                  {c.label} {sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr><td colSpan={columns.length}>No matching rows</td></tr>
          ) : (
            visible.map((r, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.key}>{String(r[c.key] ?? "")}</td>)}</tr>
            ))
          )}
        </tbody>
      </table>

      <div>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[10, 25, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Prev</button>
        <span>Page {safePage} of {totalPages}</span>
        <button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next</button>
      </div>
    </div>
  );
}
```

In real code use a stable row id for `key` (add a `getRowId` prop) and the project's `Select`/`Button` primitives.

### Details interviewers probe
- **Comparator:** `a - b` for numbers, `localeCompare` with `numeric: true` for strings so "item2" sorts before "item10". Dates should be compared as timestamps.
- **Stable sort:** modern engines guarantee stable sorting, so equal rows keep their order, which matters when cycling the sort.
- **Why `useMemo`:** sorting thousands of rows on every keystroke in an unrelated state change is wasteful; memoise per dependency.
- **Page clamp:** derive `safePage` instead of syncing page in an effect.
- **Server mode:** move `query`, `sort`, `page` and `pageSize` into the request key (`useQuery`), debounce the filter, and show `keepPreviousData` while loading.
- **Large data:** virtualise rows rather than paginate when users need continuous scrolling.

## Follow-ups
- **How would you support multi-column sort?** — Store an array of `{ key, dir }`, and have the comparator walk it until a non-zero result.
- **How would you make column definitions richer?** — Add `render`, `sortValue` and `width` to the column type, as TanStack Table does.

## Common Mistakes
- Sorting `rows` in place, mutating props.
- Keeping filtered/sorted rows in state and letting them go stale.
- Forgetting to reset the page on filter change.

## Tips
- Say "state is the controls; the rows are derived".
