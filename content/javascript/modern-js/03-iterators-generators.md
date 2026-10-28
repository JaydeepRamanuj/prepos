---
title: "What are iterators and generators? Write a custom iterable"
level: hard
type: concept
tags: [iterators, generators, Symbol.iterator, yield, lazy-evaluation]
related: [javascript/iteration-for-in-of-foreach, javascript/async-await-under-the-hood, javascript/symbols-well-known]
---

## Question
What is the iterator protocol? How do generators relate to it, how do you make an object iterable, and what are generators useful for in practice?

## Clues
- An iterable has a method under a well-known symbol that returns an object with `next()`.
- `next()` returns an object with two fields.
- Generators let a function pause and resume.

## Interview Answer
An iterable is any object with a `[Symbol.iterator]()` method that returns an iterator, an object with a `next()` method returning `{ value, done }`. `for...of`, spread, destructuring, `Array.from`, `Map` and `Set` constructors all consume this protocol. A generator function, declared with `function*`, returns an object that is both an iterator and iterable; each `yield` pauses execution and hands out a value, and the function resumes on the next `next()` call, keeping its local state. This makes lazy sequences, such as infinite ranges or paginated data, trivial to write, and `yield*` delegates to another iterable. `async function*` and `for await...of` extend it to asynchronous streams.

## Explanation
### Manual iterator

```js
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let cur = this.from;
    const end = this.to;
    return {
      next: () => (cur <= end ? { value: cur++, done: false } : { value: undefined, done: true }),
    };
  },
};
[...range];                // [1, 2, 3]
for (const n of range) {}
```

### With a generator

```js
const range2 = {
  from: 1, to: 3,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};
```

### Generators are lazy

```js
function* naturals() {
  let n = 1;
  while (true) yield n++;      // infinite, but only computed on demand
}

function* take(iter, n) {
  let i = 0;
  for (const x of iter) {
    if (i++ >= n) return;
    yield x;
  }
}
[...take(naturals(), 3)];      // [1, 2, 3]
```

### Two-way communication

```js
function* conversation() {
  const name = yield "Name?";
  yield `Hi ${name}`;
}
const g = conversation();
g.next();            // { value: "Name?", done: false }
g.next("Asha");      // { value: "Hi Asha", done: false }
```

`return()` and `throw()` let consumers close or inject errors; `for...of` calls `return()` on `break`, running `finally` blocks.

### Async generators

```js
async function* pages(url) {
  let next = url;
  while (next) {
    const res = await fetch(next);
    const data = await res.json();
    yield data.items;
    next = data.next;
  }
}
for await (const items of pages("/api/users")) render(items);
```

### Where used
Redux-saga, lazy pagination, parsing streams, state machines, and as the model behind `async/await`. Modern runtimes also provide iterator helpers (`.map`, `.filter`, `.take` on iterators) in recent releases.

## Follow-ups
- **Is an array iterator also iterable?** — Yes, built-in iterators return themselves from `[Symbol.iterator]`.
- **Can a generator be restarted?** — No; create a new one.

## Common Mistakes
- Returning an array of results instead of `{ value, done }` from `next()`.
- Forgetting that generator functions don't run until the first `next()`.

## Tips
- Show the infinite `naturals` + `take` example; it conveys laziness quickly.
