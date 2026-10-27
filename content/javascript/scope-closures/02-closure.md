---
title: "What is a closure? Show a practical example"
level: medium
type: concept
tags: [closures, scope, private-state, functions]
related: [javascript/lexical-scope, javascript/closure-loop-settimeout, javascript/memoization, javascript/closure-private-state-store]
---

## Question
What is a closure? Explain it with an example you would actually use, and describe what happens in memory when the outer function returns.

## Interview Answer
A closure is a function together with the variables from the scope it was created in. Because JavaScript is lexically scoped, an inner function keeps a reference to its outer scope, so it can still read and update those variables after the outer function has returned. A simple example is `makeCounter`: it declares `let count = 0` and returns functions that increment and read it — `count` is not reachable from outside, and each call to `makeCounter` gets its own independent `count`. The key detail is that closures capture *variables*, not values: they see the latest value, and multiple functions created in the same call share the same variable. I use closures all the time without naming them — event handlers, `debounce`, memoisation caches, React hooks, and factory functions all rely on them.

## Explanation
### The counter

```js
function makeCounter() {
  let count = 0; // lives as long as something references it

  return {
    increment: () => ++count,
    get: () => count,
  };
}

const a = makeCounter();
const b = makeCounter();
a.increment();
a.increment();
b.increment();
console.log(a.get(), b.get()); // 2 1
console.log(a.count);          // undefined — truly private
```

### What happens in memory

```txt
makeCounter() call #1                makeCounter() call #2
┌───────────────────┐                ┌───────────────────┐
│ Environment       │                │ Environment       │
│ count: 2          │                │ count: 1          │
└───────▲───────────┘                └───────▲───────────┘
        │ [[Environment]]                     │
  increment, get  (object a)            increment, get  (object b)
```

Normally a function's local variables are discarded when it returns. But each inner function holds a hidden reference (`[[Environment]]`) to the environment it was created in. As long as `a.increment` is reachable, that environment is reachable too, so the garbage collector keeps it alive. Each call to `makeCounter` creates a *new* environment — that is why `a` and `b` do not interfere.

### Variables, not snapshots

```js
function setup() {
  let message = "hello";
  const say = () => console.log(message);
  message = "bye";
  return say;
}
setup()(); // "bye" — say reads the variable at call time
```

### Where you meet closures every day

```js
// 1. Configured functions (factories)
const withPrefix = (prefix) => (msg) => `${prefix} ${msg}`;
const warn = withPrefix("[warn]");

// 2. Event handlers remembering data
items.forEach((item) => {
  button.addEventListener("click", () => select(item.id));
});

// 3. React: every render's handlers close over that render's state
function Search() {
  const [query, setQuery] = useState("");
  const submit = () => api.search(query); // closes over this render's query
  // ...
}
```

The React case is also where closures bite: a callback captured in an old render (for example inside `setInterval` with an empty dependency array) keeps seeing the *old* state — the "stale closure" bug.

## Follow-ups
- **Does every function in JS form a closure?** — Technically yes: every function keeps a reference to its defining scope. The term is usually reserved for functions that outlive that scope.
- **What is a stale closure?** — A function that captured variables from an earlier scope instance (e.g. an old React render) and keeps using outdated values. Fix with correct effect dependencies, functional updates (`setCount(c => c + 1)`) or a ref.
- **Do closures cause memory leaks?** — Only if a long-lived reference (global listener, timer, cache) keeps a closure — and everything it captured — alive after it is no longer needed.

## Common Mistakes
- Defining a closure as "a function inside a function" — the point is the *retained access to outer variables*.
- Saying closures copy values at creation time.
- Forgetting that each outer call creates a separate environment.

## Tips
- Give the textbook definition, then immediately the counter, then one real use (`debounce`, a React handler). Definition + example + real use is the winning structure.
- Mention stale closures in React to show you have debugged closures, not just read about them.
