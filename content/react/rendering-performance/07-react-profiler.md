---
title: "Typing in a form is laggy. How do you find the cause with the React Profiler?"
level: medium
type: scenario
tags: [profiler, react-devtools, performance, debugging]
related: [react/why-component-rerenders, react/state-colocation, react/react-memo-new-props, performance/inp-fixes]
---

## Question
Users report that typing into the search field on a dashboard feels laggy. Walk me through how you would find the cause using React DevTools and fix it.

## Interview Answer
First I reproduce it under realistic conditions: a production build if possible, and CPU throttling in Chrome DevTools to imitate a mid-range phone. Then I open the React DevTools Profiler, enable "Record why each component rendered while profiling", record while typing a few characters, and stop. In the flamegraph, I look for commits that take longer than one frame (about 16 ms) and check which components rendered in them, how long each took, and why each rendered, whether that was a state change, a parent render, a context change or changed props. Usually the cause is either a large subtree re-rendering on every keystroke because the input state lives too high, or one expensive component recalculating on every keystroke. I fix that by moving the state down, memoizing the expensive part, or marking the expensive update as non-urgent with `useDeferredValue`. Then I record again to confirm the commit got shorter.

## Explanation
### Step-by-step
1. **Reproduce realistically.** Use 4x–6x CPU throttling in the Performance panel. A dev build is slower than production, so look at relative costs, or profile a production build (React provides a profiling build for that).
2. **Settings (gear icon) → Profiler → "Record why each component rendered while profiling".** Also enable "Highlight updates when components render" in General for a quick visual check.
3. **Record → type 3–4 characters → stop.**
4. **Read the commit bar chart** at the top right. Each bar is one commit. Tall, yellow bars are slow.
5. **Flamegraph view**: the width of a bar is the render time of that component and its children. Grey means it did not render in this commit.
6. **Ranked view**: lists the slowest components first. This is the fastest way to find the culprit.
7. **Select a component** to see "Why did this render?", for example "Hook 1 changed", "The parent component rendered" or "Props changed: `filters`".

### Typical findings and fixes

| Finding | Fix |
|---|---|
| The whole page re-renders because `query` state lives in `Dashboard` | Move the input and its state into a `SearchBox` component (colocation) |
| `ResultsTable` (filters 5,000 rows) renders on each keystroke | `useDeferredValue(query)` for the table, so typing stays urgent and filtering can lag behind |
| A memoized child re-renders with "Props changed: `onSort`" | Make the callback stable, or enable the React Compiler |
| Every context consumer lights up | Split the context, or switch to a store with selectors |

```tsx
function Search({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query); // lags behind while React is busy
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ResultsTable rows={rows} query={deferredQuery} />
    </>
  );
}
const ResultsTable = memo(function ResultsTable({ rows, query }: { rows: Row[]; query: string }) {
  const visible = rows.filter((r) => r.name.includes(query));
  return <Table rows={visible} />;
});
```

`ResultsTable` must be memoized. Otherwise it re-renders with the parent on every keystroke anyway, and the deferral achieves nothing.

### Beyond the React Profiler
- The **Chrome Performance panel** shows the whole frame: long tasks, layout and paint. From React 19.2, React adds its own **Performance Tracks** there (Scheduler and Components), so you can see React work next to network and layout.
- The `<Profiler id onRender>` component logs render timings in code, which is useful for monitoring in production.
- In the field, track **INP** (Interaction to Next Paint) to confirm users actually notice the improvement.

## Follow-ups
- **The Profiler shows fast renders but typing is still slow. Now what?** The cost is outside React rendering: layout thrashing, a heavy `onChange` handler or a third-party script. Use the Chrome Performance panel.
- **Why is a dev build misleading?** It includes extra checks and StrictMode double rendering. Compare relative costs, or profile a production profiling build.
- **What is a commit?** The phase where React applies a render's changes to the DOM. The Profiler groups work per commit.

## Common Mistakes
- Adding `useMemo` everywhere before measuring anything.
- Profiling without throttling on a fast laptop and concluding "it's fine".
- Reading only the total render time and ignoring "why did this render", which is the part that tells you the fix.

## Tips
- Name concrete UI: "Ranked chart", "Why did this render?", "Highlight updates". It proves you have actually used the tool.
- Always finish with "record again to verify". Measuring after a fix signals engineering discipline.
