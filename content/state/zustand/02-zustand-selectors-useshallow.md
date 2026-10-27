---
title: "Why does this Zustand selector cause an infinite loop in v5, and how does useShallow fix it?"
level: medium
type: debugging
tags: [zustand, selectors, useShallow, re-renders, v5]
related: [state/zustand-create-store, state/implement-mini-zustand, state/context-vs-store]
---

## Question
After upgrading to Zustand v5, this component crashes with "Maximum update depth exceeded" (or the "getSnapshot should be cached" warning). In v4 it only re-rendered too often. Explain both behaviours and fix it.

```tsx
type Bear = { name: string };
type BearState = { bears: number; fish: number; list?: Bear[]; feed: () => void };

const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  fish: 10,
  feed: () => set((s) => ({ fish: s.fish - 1 })),
}));

function Stats() {
  const { bears, fish } = useBearStore((s) => ({ bears: s.bears, fish: s.fish }));
  const names = useBearStore((s) => s.list?.map((b) => b.name) ?? []);
  return <p>{bears} bears, {fish} fish</p>;
}
```

## Interview Answer
Zustand compares the selector's result with `Object.is`. This selector builds a new object on every call, so the result is never equal to the previous one. In v5 the hook is built directly on React's `useSyncExternalStore`, which requires `getSnapshot` to return the same value when nothing changed; a fresh object on every call looks like a change on every render, so React keeps re-rendering until it throws. In v4 the custom equality layer meant it "only" re-rendered on every store change. The fix is to make the selection stable: select primitives separately, or wrap the selector in `useShallow`, which compares the new result shallowly with the previous one and returns the previous reference when the keys and values match. The same applies to selectors that return a new array, like `.map()` or `?? []`.

## Explanation
### What the hook does
Zustand v5's `useStore` is essentially:

```ts
const slice = useSyncExternalStore(
  api.subscribe,
  () => selector(api.getState()),         // getSnapshot
  () => selector(api.getInitialState()),  // getServerSnapshot
);
```

React calls `getSnapshot` during render and again to check for tearing. If two calls return values that are not `Object.is`-equal, React assumes the store changed and schedules another render — forever.

```txt
render → selector → {bears, fish}#1
check  → selector → {bears, fish}#2   #1 !== #2 → re-render
render → selector → {bears, fish}#3   ... → "Maximum update depth exceeded"
```

### Fix 1: one selector per primitive
```tsx
const bears = useBearStore((s) => s.bears);
const fish = useBearStore((s) => s.fish);
```
Simplest and most precise. Each hook re-renders only for its own value.

### Fix 2: `useShallow`
```tsx
import { useShallow } from "zustand/react/shallow";

const { bears, fish } = useBearStore(
  useShallow((s) => ({ bears: s.bears, fish: s.fish })),
);

const [feed, bears2] = useBearStore(useShallow((s) => [s.feed, s.bears]));
```

`useShallow` keeps the previous result in a ref. If the new result is shallow-equal (same keys, each value `Object.is`-equal), it returns the **old** reference — so `useSyncExternalStore` sees a stable snapshot.

```ts
// roughly how it works
function useShallow<S, U>(selector: (state: S) => U) {
  const prev = useRef<U>();
  return (state: S) => {
    const next = selector(state);
    return shallow(prev.current, next) ? (prev.current as U) : (prev.current = next);
  };
}
```

### Fix 3: stable fallbacks
`s.list ?? []` creates a new empty array each time. Hoist it:

```ts
const EMPTY: Bear[] = [];
const list = useBearStore((s) => s.list ?? EMPTY);
```

And for derived arrays (`.map`, `.filter`), wrap in `useShallow` or select the source array and derive with `useMemo` in the component.

### Other v5 changes worth knowing
- `create` no longer accepts a custom equality function. Use `createWithEqualityFn` from `zustand/traditional` (needs the `use-sync-external-store` package) if you really need one.
- React 18 is the minimum version.

## Follow-ups
- **Is `useShallow` a deep comparison?** — No, one level only. Nested objects that are recreated will still be "different".
- **Why are actions safe to select alone?** — Action functions are created once in the store initializer, so their reference never changes.

## Common Mistakes
- Destructuring the whole store, `const { bears } = useBearStore()` — no crash, but re-renders on every change.
- Using `useShallow` everywhere by default instead of simply selecting primitives.
- Returning `?? []` or `?? {}` inline in a selector.

## Tips
- Explain it as "selectors must return a stable reference when nothing changed" — that rule covers objects, arrays, and fallbacks in one sentence.
