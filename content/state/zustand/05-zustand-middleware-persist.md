---
title: "Zustand middleware: persist, devtools, immer and subscribeWithSelector"
level: medium
type: concept
tags: [zustand, middleware, persist, devtools, immer, partialize, migrate]
related: [state/zustand-create-store, state/implement-mini-zustand, state/zustand-nextjs-per-request-store]
---

## Question
How does Zustand middleware work? Configure `persist` for a settings store (partial persistence, versioning and migration), compose `devtools` and `immer`, and explain hydration pitfalls.

## Interview Answer
Zustand middleware are functions that wrap the store initializer, receiving `(set, get, api)` and returning an enhanced initializer, so they compose by nesting: `create<State>()(devtools(persist(immer((set) => ({...})), { name: "settings" })))`. `persist` saves state to a storage (localStorage by default via `createJSONStorage`), rehydrates on startup, and supports `partialize` to choose which fields to save, `version` plus `migrate` to evolve the stored shape, and `merge` to control how stored state combines with current state. `devtools` connects to the Redux DevTools extension for time-travel and action names, `immer` lets you write mutating updates that produce immutable results, and `subscribeWithSelector` allows subscribing to slices outside React. In SSR frameworks, persisted state from localStorage isn't available on the server, so the first client render must match the server (use `skipHydration` and rehydrate in an effect, or a hydration flag) to avoid mismatch.

## Explanation
### Composition

```ts
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type Settings = {
  theme: "light" | "dark";
  fontSize: number;
  recentSearches: string[];
  hydrated: boolean;
  setTheme: (t: Settings["theme"]) => void;
  addSearch: (q: string) => void;
};

export const useSettings = create<Settings>()(
  devtools(
    persist(
      immer((set) => ({
        theme: "light",
        fontSize: 16,
        recentSearches: [],
        hydrated: false,
        setTheme: (theme) => set((s) => { s.theme = theme; }, false, "settings/setTheme"),
        addSearch: (q) =>
          set((s) => {
            s.recentSearches = [q, ...s.recentSearches.filter((x) => x !== q)].slice(0, 5);
          }, false, "settings/addSearch"),
      })),
      {
        name: "app-settings",                                   // storage key
        version: 2,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ theme: s.theme, fontSize: s.fontSize, recentSearches: s.recentSearches }),   // skip actions & flags
        migrate: (persisted: any, fromVersion) => {
          if (fromVersion < 2) return { ...persisted, fontSize: persisted.fontSize ?? 16 };
          return persisted;
        },
        onRehydrateStorage: () => (state) => { state?.hydrated; },
      }
    ),
    { name: "SettingsStore" }
  )
);
```

The curried `create<State>()(...)` form is required for TypeScript inference with middleware.

### Middleware order matters
Typically `devtools(persist(immer(...)))`: the outermost wraps the others, so devtools sees all actions; `immer` sits innermost so `set` accepts draft-mutating functions before persist/devtools see the resulting plain state. Check the docs for recommended order and TS typing implications.

### `persist` options

| Option | Purpose |
|---|---|
| `name` | storage key (required) |
| `storage` | `createJSONStorage(() => localStorage | sessionStorage | custom)` (async storages like IndexedDB supported) |
| `partialize` | choose fields to persist (never persist functions or secrets) |
| `version` / `migrate` | handle stored-shape changes |
| `merge` | custom merge of persisted and current state (default shallow merge) |
| `skipHydration` | don't auto-rehydrate; call `useStore.persist.rehydrate()` manually |
| `onRehydrateStorage` | callbacks before/after hydration (loading flags, errors) |
| `useStore.persist.clearStorage()`, `.hasHydrated()`, `.onFinishHydration()` | utilities |

### Hydration with SSR (Next.js)
The server renders with initial state; the client reads localStorage and may have different values → hydration mismatch.

```tsx
// Option 1: skip automatic hydration; rehydrate after mount
persist(..., { name: "app-settings", skipHydration: true });

function StoreHydrator() {
  useEffect(() => { useSettings.persist.rehydrate(); }, []);
  return null;
}

// Option 2: render persisted-dependent UI only after hydration
const hydrated = useSettings((s) => s.hydrated);       // set via onRehydrateStorage / onFinishHydration
return hydrated ? <ThemeToggle /> : <ThemeToggleSkeleton />;
```

For theme and other first-paint preferences, prefer cookies read on the server to avoid flashes.

### Other middleware

```ts
import { subscribeWithSelector } from "zustand/middleware";

const useStore = create<S>()(subscribeWithSelector((set) => ({ count: 0 /* … */ })));
useStore.subscribe((s) => s.count, (count, prev) => console.log(count, prev), { fireImmediately: false });
```

- `combine` helper for inferring types from the initial state.
- `redux` middleware for reducer-style stores.
- Custom middleware: `const logger = (f) => (set, get, api) => f((...args) => { console.log(args); set(...args); }, get, api);`.

### Pitfalls
- Persisting everything (functions are skipped by JSON, but flags like `hydrated` or sensitive data should not be persisted).
- Forgetting `version`/`migrate` when changing the shape: users get crashes from old data.
- localStorage is synchronous, size-limited (~5 MB) and shared between tabs: use the `storage` event or `broadcast` patterns if tabs must sync.
- Writing on every state change for large objects: throttle via custom storage.
- Using immer with large state: overhead; fine for typical UI state.
- Devtools in production: enable only in development (`enabled: process.env.NODE_ENV !== "production"`).

## Follow-ups
- **`sessionStorage` vs `localStorage`?** — Per-tab vs persistent across sessions; pick by data lifetime.
- **How do you reset persisted state?** — `useStore.persist.clearStorage()` and `useStore.setState(useStore.getInitialState(), true)`.

## Common Mistakes
- Hydration mismatches from reading persisted state in the first render.
- Missing curried `create<T>()` and losing types.
- Persisting auth tokens in localStorage without understanding XSS risk.

## Tips
- Mention `partialize`, `version/migrate`, and SSR `skipHydration`.
