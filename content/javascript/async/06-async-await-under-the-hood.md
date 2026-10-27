---
title: "How does async/await work under the hood?"
level: medium
type: concept
tags: [async-await, promises, microtasks, generators]
related: [javascript/promise-chaining-error-handling, javascript/sequential-vs-parallel-await, javascript/async-output-order]
---

## Question
What does an `async` function return, and what actually happens when execution reaches an `await`? How does error handling differ from promise chains?

## Interview Answer
An `async` function always returns a promise: the returned value fulfills it and a thrown error rejects it. It runs synchronously, like any function, until the first `await`. At `await`, the function pauses, its state is saved, and control returns to the caller; the awaited value is converted with `Promise.resolve`, and when it settles the rest of the function is resumed as a microtask. If the promise rejected, `await` throws at that point, so ordinary `try/catch` works. It is syntax sugar over promises, conceptually like a generator driven by a promise runner, which makes sequential async code read like sync code.

## Explanation
### Sync until the first await

```js
async function f() {
  console.log("1");
  await null;
  console.log("3");
}
f();
console.log("2");
// 1, 2, 3
```

### Return values

```js
async function a() { return 1; }        // Promise<1>
async function b() { throw new Error("x"); } // rejected promise
a().then(console.log);
```

### Error handling

```js
async function load() {
  try {
    const res = await fetch("/api");
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    hideSpinner();
  }
}
```

Note `return await` inside `try` — without `await`, a rejection from `res.json()` would escape the `catch`.

### The generator analogy

```js
function run(genFn) {
  const gen = genFn();
  return new Promise((resolve, reject) => {
    function step(method, arg) {
      let r;
      try { r = gen[method](arg); } catch (e) { return reject(e); }
      if (r.done) return resolve(r.value);
      Promise.resolve(r.value).then((v) => step("next", v), (e) => step("throw", e));
    }
    step("next");
  });
}
```

`yield` plays the role of `await`; this is how `co` and early transpilers worked.

### Other rules
- `await` works on any thenable, and non-promises are wrapped.
- Top-level `await` is available in ES modules.
- `await` in a `forEach` callback does not pause the loop (see the sequential vs parallel question).

## Follow-ups
- **How many microtask ticks does `await` take?** — One for a native promise in modern engines; older specs took three.
- **Can you use `await` in a non-async function?** — No, except top-level in modules.

## Common Mistakes
- Believing `await` blocks the thread; only the function is suspended.
- Forgetting that an `async` function without `await` still returns a promise.

## Tips
- Mention "sync until first await" and "continuation is a microtask" — they explain every ordering question.
