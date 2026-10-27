---
title: "Build an autocomplete/typeahead with debouncing, race-condition safety and keyboard navigation"
level: hard
type: implement
tags: [autocomplete, debounce, abort-controller, combobox, aria, keyboard, race-conditions]
related: [machine-coding/dropdown-select, machine-coding/infinite-scroll, javascript/debounce-throttle]
---

## Question
Build a search box that suggests results from an API as the user types.

**Must-haves**
- Debounce requests (about 300ms) and skip empty queries.
- Show loading, empty and error states.
- Out-of-order responses must never overwrite newer results.
- Arrow Up/Down move the highlight, Enter selects, Escape closes.
- Click on a suggestion selects it.

**Stretch goals**
- Cache results per query.
- Highlight the matching part of each suggestion.
- ARIA combobox semantics.

```tsx
<Autocomplete fetchSuggestions={(q, signal) => api.search(q, signal)} onSelect={setCity} />
```

## Clues
- A slow response for "ab" can arrive after the fast response for "abc". Cancel the previous request with `AbortController` (or ignore stale ones with a flag in the effect cleanup).
- The debounce belongs in an effect that re-runs on the query and cleans up its timer.
- Keep `activeIndex` in state and reset it to `-1` whenever results change.

## Interview Answer
I hold `query`, `results`, `status`, `activeIndex` and `open` in state. An effect keyed on `query` starts a 300ms timer; if the query is blank it clears the results, otherwise after the delay it calls the fetcher with an `AbortSignal`. The effect's cleanup clears the timer and aborts the in-flight request, which fixes the race condition: only the latest query's response can ever be applied, and aborted fetches are ignored. Results are cached in a `Map` ref by query so retyping is instant. Keyboard handling lives in `onKeyDown` on the input: ArrowDown/Up change `activeIndex` with wrap-around, Enter selects the active item, Escape closes. For accessibility the input has `role="combobox"`, `aria-expanded`, `aria-controls` the listbox and `aria-activedescendant` pointing at the highlighted option, while real focus stays in the input.

## Explanation
### The race
```txt
type "ab"  → request A (slow, 900ms)
type "abc" → request B (fast, 200ms)
B returns → shows results for "abc"
A returns → overwrites with results for "ab"   ← bug
```
Cleanup in the effect aborts A when the query changes to "abc", so A's result is never set.

### Code

```tsx
import { useEffect, useId, useRef, useState } from "react";

type Props<T> = {
  fetchSuggestions: (q: string, signal: AbortSignal) => Promise<T[]>;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  delay?: number;
};

export function Autocomplete<T>({ fetchSuggestions, getLabel, onSelect, delay = 300 }: Props<T>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const cache = useRef(new Map<string, T[]>());
  const listId = useId();

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setStatus("idle"); return; }

    const cached = cache.current.get(q);
    if (cached) { setResults(cached); setStatus("idle"); setActive(-1); return; }

    const controller = new AbortController();
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const data = await fetchSuggestions(q, controller.signal);
        cache.current.set(q, data);
        setResults(data);
        setStatus("idle");
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, delay);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, delay, fetchSuggestions]);

  function choose(item: T) {
    setQuery(getLabel(item));
    setOpen(false);
    onSelect(item);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => (i + 1) % Math.max(results.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1)); }
    else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}  // lets a click on an option land first
      />
      {open && query.trim() && (
        <ul id={listId} role="listbox" className="absolute w-full border bg-surface">
          {status === "loading" && <li className="p-2">Loading…</li>}
          {status === "error" && <li className="p-2">Something went wrong. Try again.</li>}
          {status === "idle" && results.length === 0 && <li className="p-2">No results</li>}
          {results.map((item, i) => (
            <li
              key={i}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "bg-accent p-2" : "p-2"}
              onMouseDown={(e) => e.preventDefault()}   // keep input focus
              onClick={() => choose(item)}
            >
              {getLabel(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`fetchSuggestions` should be a stable reference (defined outside the component or wrapped in `useCallback`), otherwise the effect re-runs on every render and the debounce never settles.

### Design decisions
- **Debounce vs throttle:** debounce waits for a pause, which fits typing. Throttle would still fire mid-word.
- **Abort vs ignore flag:** abort also frees the network and server work; the flag approach works when the API cannot be cancelled.
- **Cache:** keyed by trimmed, lower-cased query; bound its size for long sessions.
- **Selecting sets the query,** which would re-trigger the search. Guard with a "just selected" ref if that opens the list again.
- **Highlighting matches:** split the label on a case-insensitive regex of the escaped query and wrap matches in `<mark>`.

## Follow-ups
- **How would this change with TanStack Query?** — `useQuery` with `queryKey: ["search", debouncedQuery]` and `enabled`; it handles caching, dedupe and stale responses, leaving a `useDebouncedValue` hook for the delay.
- **How do you handle IME composition?** — Skip searching between `compositionstart` and `compositionend`.

## Common Mistakes
- Debouncing inside the handler with a fresh function each render.
- Not cancelling stale requests.
- Moving real focus into the list, breaking typing.

## Tips
- Draw the out-of-order timeline first; interviewers look for it.
