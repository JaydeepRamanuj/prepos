---
title: "Write a useLocalStorage hook that is SSR-safe and syncs across tabs"
level: hard
type: implement
tags: [custom-hooks, localStorage, useSyncExternalStore, ssr, hydration]
related: [react/use-sync-external-store, react/use-event-listener, nextjs/hydration-mismatch-scenario]
---

## Question
Write `useLocalStorage<T>(key, initialValue)` returning `[value, setValue]`. It must parse JSON, persist updates, support functional updates, avoid hydration mismatches in an SSR app, and update when another tab changes the key.

```tsx
const [theme, setTheme] = useLocalStorage("theme", "light");
```

## Clues
- On the server there's no `localStorage`; the first client render must match the server HTML.
- The `storage` event fires in *other* tabs, not the one that wrote.
- This is a subscribable external store.

## Interview Answer
The robust approach is `useSyncExternalStore`: `subscribe` listens for the `storage` event (other tabs) and a custom event I dispatch in the same tab; `getSnapshot` reads the raw string from `localStorage`; and `getServerSnapshot` returns the initial value so server output and hydration agree. I parse the string to a value with `useMemo` (snapshots must be stable, so I compare raw strings, not parsed objects). The setter accepts a value or an updater function, serialises with `JSON.stringify`, writes the key, and dispatches an event so other hook instances in the same tab update. Everything is wrapped in `try/catch` because storage can throw in private mode or when full.

## Explanation
### Implementation

```tsx
import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);       // other tabs
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readRaw(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),                 // snapshot is a string/null: stable by value
    () => null                          // server snapshot: nothing stored
  );

  const value = useMemo<T>(() => {
    if (raw === null) return initialValue;
    try { return JSON.parse(raw) as T; } catch { return initialValue; }
  }, [raw]);                            // initialValue intentionally omitted: treat as constant

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = (() => {
        const r = readRaw(key);
        try { return r === null ? initialValue : (JSON.parse(r) as T); } catch { return initialValue; }
      })();
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch { /* quota exceeded or storage disabled */ }
      emit();                           // same-tab subscribers; `storage` does not fire here
    },
    [key]
  );

  return [value, setValue] as const;
}
```

### Why this design
- **Hydration:** the server snapshot returns `null`, so both server and first client render use `initialValue`; React then re-renders with the stored value after hydration, without a mismatch warning.
- **Cross-tab:** the browser fires `storage` in other documents of the same origin.
- **Same-tab sync:** `storage` does not fire in the tab that made the change, so the hook broadcasts through its own listener set.
- **Stable snapshots:** comparing raw strings avoids the infinite-loop trap of returning freshly parsed objects.

### Simpler `useState` + `useEffect` version
Reading `localStorage` inside the `useState` initialiser on the client causes a hydration mismatch with SSR; reading it in an effect causes a flash of the default. For pure client apps (no SSR) a lazy initialiser is fine:

```tsx
const [v, setV] = useState(() => {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? initialValue; } catch { return initialValue; }
});
useEffect(() => { localStorage.setItem(key, JSON.stringify(v)); }, [key, v]);
```

### Edge cases
- Don't store secrets or tokens meant to be hidden from XSS in `localStorage`.
- Synchronous API: avoid very large values.
- Different tabs may disagree on schema; version your keys.
- Safari private mode and blocked storage throw: always `try/catch`.

## Follow-ups
- **Why not just `useEffect` to read the value?** — It renders the default first and flashes; with SSR you need the server snapshot logic anyway.
- **How would you test it?** — Mock `localStorage`, dispatch a `StorageEvent`, assert the value updates.

## Common Mistakes
- Reading `localStorage` during render on the server.
- Returning a new parsed object from `getSnapshot`.
- Assuming `storage` fires in the same tab.

## Tips
- Mention hydration and the same-tab event; they are the two classic bugs.
