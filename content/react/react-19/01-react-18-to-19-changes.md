---
title: "What changed in React 19 (and 19.x) compared to React 18?"
level: medium
type: concept
tags: [react-19, actions, use, ref-as-prop, migration, whats-new]
related: [react/use-action-state, react/use-optimistic, react/ref-as-prop, react/react-compiler]
---

## Question
Summarise the most important changes in React 19 for application developers. What was removed or deprecated, and what should you know about 19.1 and 19.2 additions?

## Interview Answer
React 19 stabilised the Actions model: async functions used in transitions and forms, with new hooks `useActionState`, `useOptimistic` and `useFormStatus`, and `<form action={fn}>` accepting functions. It added the `use` API to read promises and context during render, stabilised Server Components and Server Actions, made `ref` a regular prop, lets you render `<Context>` as a provider, and added document metadata support (`<title>`, `<meta>`, `<link>` hoisted to `<head>`), resource preloading APIs, and better error reporting and hydration diffs. Breaking cleanups removed `propTypes`, `defaultProps` for functions, string refs, legacy context and `ReactDOM.render`; `forwardRef` is no longer needed. The React Compiler became stable around 19.x as a separate build step. React 19.2 added `<Activity>`, `useEffectEvent` and partial pre-rendering primitives.

## Explanation
### Headline features

| Area | React 18 | React 19 |
|---|---|---|
| Mutations | manual `useState` + `fetch` + loading flags | Actions: async functions in transitions |
| Forms | `onSubmit` + `preventDefault` | `<form action={fn}>`, auto-reset, `useFormStatus`, `useActionState` |
| Optimistic UI | custom state juggling | `useOptimistic` |
| Reading async data | `useEffect` or libraries | `use(promise)` with Suspense |
| Refs | `forwardRef` | `ref` prop; callback ref cleanup |
| Context | `<Ctx.Provider>` | `<Ctx>` |
| Metadata | `react-helmet` / framework | `<title>`, `<meta>`, `<link>` in components |
| Server | experimental in frameworks | Server Components & Actions stable |
| Errors | duplicated logs | `onCaughtError`, `onUncaughtError`, `onRecoverableError` |
| Custom elements | partial | full support |

### Code snapshots

```tsx
// Action + pending state
function Rename({ id }: { id: string }) {
  const [error, submit, isPending] = useActionState(async (_prev: string | null, fd: FormData) => {
    const res = await renameUser(id, String(fd.get("name")));
    return res.ok ? null : res.error;
  }, null);

  return (
    <form action={submit}>
      <input name="name" />
      <button disabled={isPending}>Save</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

// use() reads a promise; suspends until resolved
function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = use(promise);
  return <ul>{comments.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}
```

### Removed / changed (migration checklist)
- `ReactDOM.render`, `hydrate`, `unmountComponentAtNode`, `findDOMNode` removed: use `createRoot`/`hydrateRoot`.
- `propTypes` ignored; use TypeScript. `defaultProps` removed for function components: use default parameters.
- String refs and legacy context removed; module pattern factories removed.
- `react-test-renderer` deprecated; use Testing Library.
- New JSX transform required.
- TypeScript: `useRef` requires an argument; `ReactElement["props"]` defaults to `unknown`.
- `useReducer` types simplified; `ref` callbacks must not return values other than cleanup functions.

### 19.1 and 19.2 highlights
- **19.1:** Owner Stacks in development (better component stack traces), plus Suspense and hydration fixes.
- **19.2:** `<Activity>` (hide/show UI while preserving state, deprioritising hidden work), `useEffectEvent`, performance tracks in Chrome DevTools, `cacheSignal` for Server Components, and partial pre-rendering APIs.
- The React Compiler (v1) is a Babel/SWC plugin, not part of React itself.

### What to say in an interview
Focus on Actions, `use`, refs, server components and the compiler, and give one concrete migration impact (`forwardRef`, `defaultProps`, `ReactDOM.render`).

## Follow-ups
- **Do I need React 19 to use the compiler?** — It supports React 17+ with a runtime package, but is designed for 19.
- **Is `useFormStatus` the same as `useActionState`?** — No: `useFormStatus` reads the parent form's pending status; `useActionState` manages a specific action's result.

## Common Mistakes
- Believing Server Components are a "new React 19 feature" needing no framework; they require a bundler/framework integration.
- Using `useFormStatus` in the same component that renders the form.

## Tips
- Organise the answer by themes (forms, data, refs, server, cleanup) rather than a list.
