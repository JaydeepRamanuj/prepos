---
title: "Build a search-as-you-type component with debounce, loading, errors and keyboard navigation"
level: hard
type: implement
tags: [search, autocomplete, debounce, abort, accessibility, combobox]
related: [react/use-debounce, react/fetch-in-effect-race, machine-coding/autocomplete-typeahead, javascript/abort-controller-cancellation]
---

## Question
Implement `<Autocomplete>` that queries `/api/search?q=` as the user types. Requirements: debounce input, cancel stale requests, show loading/empty/error states, support ArrowUp/ArrowDown/Enter/Escape, and be screen-reader friendly (combobox pattern).

## Clues
- Separate the input value from the debounced query.
- Track the highlighted index in state and keep it in range when results change.
- ARIA roles: `combobox`, `listbox`, `option`, plus `aria-activedescendant`.

## Interview Answer
I keep the input value in state, derive a debounced query with `useDebounce`, and fetch in an effect keyed on the debounced query with an `AbortController` so stale responses are cancelled. I model the request as a status (`idle`, `loading`, `success`, `error`) with results. Keyboard handling lives in `onKeyDown` on the input: arrows move an `activeIndex` state with wrap-around, Enter selects the active option, and Escape closes the list. For accessibility I use the ARIA combobox pattern: the input has `role="combobox"`, `aria-expanded`, `aria-controls` pointing at a `role="listbox"` list, and `aria-activedescendant` set to the active option's id so focus stays in the input while screen readers announce the highlighted option. I also reset the active index when results change and close the list on outside click or blur.

## Explanation
### Implementation

```tsx
import { useEffect, useId, useState } from "react";

type Item = { id: string; label: string };

export function Autocomplete({ onSelect }: { onSelect: (item: Item) => void }) {
  const [input, setInput] = useState("");
  const query = useDebounce(input.trim(), 250);
  const [state, setState] = useState<{ status: "idle" | "loading" | "success" | "error"; items: Item[] }>({
    status: "idle", items: [],
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  useEffect(() => {
    if (!query) { setState({ status: "idle", items: [] }); return; }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: "loading" }));
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Item[]>; })
      .then((items) => { setState({ status: "success", items }); setActive(-1); })
      .catch((e) => { if (e.name !== "AbortError") setState({ status: "error", items: [] }); });
    return () => controller.abort();
  }, [query]);

  function choose(item: Item) {
    setInput(item.label);
    setOpen(false);
    onSelect(item);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const n = state.items.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => (i + 1) % Math.max(n, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? n - 1 : i - 1)); }
    else if (e.key === "Enter" && open && active >= 0) { e.preventDefault(); choose(state.items[active]); }
    else if (e.key === "Escape") setOpen(false);
  }

  const showList = open && query !== "";
  return (
    <div>
      <input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 100)}   // let option clicks register
      />
      {showList && (
        <ul id={listId} role="listbox">
          {state.status === "loading" && <li role="status">Searching…</li>}
          {state.status === "error" && <li role="alert">Something went wrong</li>}
          {state.status === "success" && state.items.length === 0 && <li role="status">No results</li>}
          {state.items.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}       // keep focus in the input
              onClick={() => choose(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Design decisions
- **Debounce the query, not the input**: typing stays responsive.
- **AbortController**: avoids race conditions and wasted work.
- **`aria-activedescendant`**: focus never leaves the input, so typing continues while arrow keys move the highlight.
- **`onMouseDown` preventDefault**: stops the input from blurring before the click lands.
- **Reset `active`** on new results to avoid pointing at a nonexistent index.
- **Status flags in a single state** prevent impossible combinations.

### Improvements
- Cache recent queries (a `Map`) to avoid refetching.
- Highlight matching text.
- Announce the number of results through a visually hidden live region.
- Min query length and trimming.
- Use a library (Downshift, React Aria, Radix/shadcn Combobox) in production.
- Scroll the active option into view.

### Complexity
O(results) per render; one network call per settled query.

## Follow-ups
- **How would you handle IME composition?** — Ignore changes during `compositionstart`/`compositionend` before searching.
- **How would you virtualise 10k results?** — Windowing with `aria-setsize`/`aria-posinset`.

## Common Mistakes
- Debouncing the controlled value itself.
- Forgetting to cancel stale requests.
- Moving DOM focus into list items, breaking typing.

## Tips
- Name the ARIA combobox attributes; they signal accessibility awareness.
