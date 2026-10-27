---
title: "How do you design a good custom hook? When is a hook the wrong abstraction?"
level: advanced
type: design
tags: [custom-hooks, abstraction, rules-of-hooks, api-design, composition]
related: [react/use-event-listener, react/use-fetch, react/you-might-not-need-an-effect, react/state-colocation]
---

## Question
What makes a custom hook well designed? Cover what a hook should share (and not share), API shape, rules of hooks, testing, and signs that you should not extract a hook.

## Clues
- Hooks share logic, not state.
- Think about what the caller must pass in, what it gets back, and what could change.
- Not every effect or piece of state deserves its own hook.

## Interview Answer
A custom hook is a function that calls other hooks to package reusable stateful logic; each call gets its own isolated state, so hooks share logic, not state. A good hook has a single purpose, a name starting with `use` that describes what it does for the component (`useOnlineStatus`, not `useOnlineStatusEffect`), and a small, stable API: accept plain values or options objects, return a tuple for two values or an object for more, and keep returned callbacks stable. It should clean up everything it subscribes to, avoid hidden global dependencies, and be SSR-safe. I extract a hook when logic is reused or when it hides tangled effects behind a meaningful name, not merely to move code elsewhere. If it only wraps a single `useState`, or couples to one component's markup, it's probably the wrong abstraction.

## Explanation
### What a hook is
Calling `useCounter()` in two components gives two independent counters. If you want shared state, lift it up, use context, or use a store.

### Design checklist

| Concern | Guideline |
|---|---|
| Name | `use` + what it provides: `useMediaQuery`, `useDebounce`. Lint depends on the prefix |
| Single purpose | Do one thing; compose bigger hooks from smaller ones |
| Inputs | Primitives or a stable options object; don't force callers to memoise |
| Outputs | `[value, setValue]` for pair, `{ a, b, c }` for several; stable callbacks (`useCallback`) |
| Cleanup | Every subscription, timer, listener and request is cleaned up |
| Latest callbacks | Accept inline functions without resubscribing (latest ref or `useEffectEvent`) |
| SSR | No `window` access during render; use `useSyncExternalStore` with a server snapshot |
| Types | Generic where it makes sense (`useLocalStorage<T>`); narrow return types with `as const` |
| Errors | Surface failures through state or throw to an error boundary; don't swallow |

### Example of composition

```tsx
function useDebouncedSearch(query: string) {
  const debounced = useDebounce(query, 300);
  return useFetch<Result[]>(debounced ? `/api/search?q=${encodeURIComponent(debounced)}` : null);
}
```

### Rules of hooks
Call hooks at the top level, in the same order every render, only from components or other hooks. These rules are why a hook cannot be called conditionally or in loops, and why `use` prefix lets the linter verify them. `use(promise)` is an exception that may be called conditionally.

### Testing
Test hooks through a small component, or `renderHook` from Testing Library, then assert on results using `act` for state changes. Prefer testing the behaviour a component shows.

### Signs of a bad hook
- It takes a component's props object and returns JSX: that's a component.
- It just renames `useState`.
- It needs many boolean flags to configure behaviour: split it.
- It hides an effect that shouldn't exist (see "you might not need an effect").
- It contains business rules mixed with UI concerns; extract pure functions and test those.

### When not to write a hook
Derived values (`const full = first + last`), event handlers used once, and anything a library already provides (`useQuery`, `useForm`). Plain functions are better when no React state or effects are involved.

### With the React Compiler
Hooks that follow the Rules of React are compiled and memoised automatically, making stable return values easier, but returning stable functions is still good API design.

## Follow-ups
- **Do hooks share state between components?** — No; each call site has its own state.
- **How would you document a hook?** — Typed signature, a small usage example, cleanup/SSR notes.

## Common Mistakes
- Extracting hooks too early or around one `useState`.
- Hooks that return new objects/functions every render, defeating consumers' memoisation.
- Forgetting cleanup.

## Tips
- Use the phrase "share logic, not state" and give one example of a good and one of a bad extraction.
