---
title: "What are the data types in JavaScript, and what are the quirks of typeof?"
level: easy
type: concept
tags: [types, typeof, primitives, fundamentals]
related: [javascript/null-vs-undefined, javascript/nan-and-number-quirks, javascript/shallow-vs-deep-copy]
---

## Question
How many data types does JavaScript have? What is the difference between primitives and objects, and what does `typeof` return for each? Which results surprise people?

## Interview Answer
JavaScript has eight types: seven primitives — `string`, `number`, `bigint`, `boolean`, `undefined`, `symbol` and `null` — and `object`, which covers arrays, functions, dates, maps and everything else. Primitives are immutable and compared by value; objects are mutable and compared by reference, so two identical-looking objects are not `===`. `typeof` is mostly reliable, with two famous quirks: `typeof null` is `"object"`, a bug from the first implementation kept for compatibility, and `typeof` a function is `"function"` even though functions are objects. Arrays report `"object"`, so I use `Array.isArray` for them, and `value === null` for null. `typeof` on an undeclared variable returns `"undefined"` instead of throwing, which is why it was used for feature detection.

## Explanation
### The eight types

| Type | Example | `typeof` |
|---|---|---|
| string | `"hi"` | `"string"` |
| number | `42`, `NaN`, `Infinity` | `"number"` |
| bigint | `10n` | `"bigint"` |
| boolean | `true` | `"boolean"` |
| undefined | `undefined` | `"undefined"` |
| symbol | `Symbol("id")` | `"symbol"` |
| null | `null` | `"object"` ← historical bug |
| object | `{}`, `[]`, `new Date()` | `"object"` |
| (function — still an object) | `() => {}`, `class {}` | `"function"` |

### Primitives vs objects
A primitive *is* its value. You cannot mutate `"abc"`; `str.toUpperCase()` returns a new string. When you call a method on a primitive, JS briefly wraps it in an object (`String`, `Number`…) to find the method on its prototype, then throws the wrapper away.

Objects are stored by reference. Assigning or passing an object copies the reference, not the object:

```js
const a = { n: 1 };
const b = a;      // same object
b.n = 2;
console.log(a.n); // 2
console.log({ n: 1 } === { n: 1 }); // false — different references
```

JavaScript is always *pass-by-value* — but for objects the value being copied is the reference. Reassigning a parameter inside a function does not affect the caller; mutating it does.

### Checking types reliably

```js
typeof x === "string"            // primitives (except null)
x === null                       // null
Array.isArray(x)                 // arrays (works across iframes, unlike instanceof)
typeof x === "function"          // callables
x instanceof Date                // class instances from the same realm
Object.prototype.toString.call(x) // "[object Date]", "[object RegExp]"... the catch-all
```

### Why `typeof null === "object"`
In the first engine, values carried a type tag; objects had tag `0`, and `null` was the null pointer — also all zeros. A fix was proposed for ES2015 but rejected because it broke existing sites.

## Follow-ups
- **What does `typeof undeclaredVariable` return?** — `"undefined"`, no error. But inside the TDZ of a `let`/`const` it throws a `ReferenceError`.
- **How do you check for a plain object?** — `x !== null && typeof x === "object" && !Array.isArray(x)`, or `Object.getPrototypeOf(x) === Object.prototype` if you need to exclude class instances.
- **Is `typeof NaN` a trick?** — It is `"number"`: NaN is a numeric value meaning "not a valid number result".

## Common Mistakes
- Listing "array" or "function" as separate types — they are objects.
- Using `typeof x === "object"` as an object check and forgetting it is true for `null`.
- Saying objects are "pass-by-reference" — reassigning a parameter does not change the caller's variable.

## Tips
- Memorise "7 primitives + object" and the two exceptions: `null → "object"`, function → `"function"`.
- Mentioning *why* `typeof null` is broken (type tags, backward compatibility) shows real depth in an easy question.
