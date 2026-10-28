---
title: "This code is slow: why, and how do you fix awaiting inside loops?"
level: medium
type: debugging
tags: [async-await, concurrency, promise-all, foreach, performance]
related: [javascript/promise-combinators, javascript/async-await-under-the-hood, javascript/promise-all-polyfill]
---

## Question
These functions fetch 10 users. One is too slow and one finishes before the data is ready. Explain what is wrong and fix both.

```js
async function loadAll(ids) {
  const users = [];
  for (const id of ids) {
    users.push(await fetchUser(id));
  }
  return users;
}

async function loadAll2(ids) {
  const users = [];
  ids.forEach(async (id) => {
    users.push(await fetchUser(id));
  });
  return users;
}
```

## Interview Answer
The first version is correct but sequential: each `await` waits for the previous request, so total time is the sum of all requests instead of the slowest one. If the calls are independent, I start them all and await together with `Promise.all(ids.map(fetchUser))`. The second version is a bug: `forEach` ignores the promises returned by its async callback, so it does not wait; `loadAll2` returns the empty array immediately and fills it later. Use `map` with `Promise.all`, or a `for...of` loop when I really need order or one-at-a-time execution. For large lists I limit concurrency instead of firing everything at once.

## Explanation
### Fixes

```js
// Parallel, results in input order
const loadAll = (ids) => Promise.all(ids.map(fetchUser));

// Sequential on purpose (each depends on the previous, or rate limits)
async function loadSeq(ids) {
  const out = [];
  for (const id of ids) out.push(await fetchUser(id));
  return out;
}
```

### Why `forEach` fails
`forEach` calls the callback and discards its return value, so each async callback returns a promise nobody awaits. The function body continues straight to `return users`.

### Timing

```txt
sequential: |--A--|--B--|--C--|           total = A+B+C
parallel:   |--A--|
            |--B--|
            |--C--|                      total = max(A,B,C)
```

### The trap: starting then awaiting

```js
const a = await getA();
const b = await getB();      // sequential even though independent

const pa = getA(), pb = getB();   // started together
const [a2, b2] = [await pa, await pb];
```

### Limiting concurrency
For hundreds of requests, `Promise.all` fires them all at once and may hit browser connection limits or rate limits. Use a small pool (for example, N workers each pulling the next id from a shared index) or a library like `p-limit`.

### When sequential is right
Dependent steps, ordered side effects, or APIs that cannot handle parallel writes.

## Follow-ups
- **What if one request fails?** — `Promise.all` rejects on the first failure; use `allSettled` when you want the rest.
- **Does `for await` help?** — It iterates async iterables; with an array of promises it still awaits one by one.

## Common Mistakes
- Awaiting independent calls one after another.
- Using `forEach`, `filter` or `reduce` with async callbacks and expecting them to wait.

## Tips
- Say "the slowest, not the sum" and name the `forEach` pitfall — both are common interview probes.
