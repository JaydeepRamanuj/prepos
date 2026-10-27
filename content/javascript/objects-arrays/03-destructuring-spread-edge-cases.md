---
title: "Destructuring, spread and rest: syntax, defaults and edge cases"
level: medium
type: concept
tags: [destructuring, spread, rest, default-values, es6]
related: [javascript/shallow-vs-deep-copy, javascript/null-vs-undefined, javascript/higher-order-functions]
---

## Question
Explain destructuring, spread and rest. How do default values work, and which edge cases (null, renaming, nested, evaluation order) matter?

## Interview Answer
Destructuring pulls values out of arrays or objects into variables: arrays by position, objects by property name, with renaming (`{a: x}`), nested patterns and defaults (`{a = 1}`). A default applies only when the value is `undefined`, not `null`. Rest (`...rest`) in a pattern or in function parameters collects the remaining items into a new array or object, while spread (`...x`) in a literal or call expands an iterable or object's own enumerable properties. Spread is shallow, and later properties override earlier ones. Destructuring `null` or `undefined` throws a TypeError.

## Explanation
### Objects and arrays

```js
const user = { id: 1, name: "Asha", address: { city: "Pune" }, tags: ["a", "b"] };

const { name, role = "guest" } = user;            // default for missing
const { name: userName } = user;                  // rename
const { address: { city } } = user;               // nested (address itself not bound)
const { id, ...others } = user;                   // rest object
const [first, , third = 0, ...tail] = [1, 2, undefined, 4, 5];   // skip, default, rest
```

### Defaults apply only to `undefined`

```js
const { a = 1 } = { a: null };       // a === null
const { b = 1 } = { b: undefined };  // b === 1
```

### Function parameters

```js
function connect({ host = "localhost", port = 3000 } = {}) {}
connect();            // works because of the = {} default
connect({ port: 80 });
```

Without `= {}`, `connect()` throws "Cannot destructure property of undefined".

### Swapping and iterables

```js
[a, b] = [b, a];
const [x, y] = new Set([1, 2]);   // any iterable
```

### Spread vs rest

| | Where | Does |
|---|---|---|
| rest | pattern / parameter list (left side) | collects into array/object |
| spread | literal / call arguments (right side) | expands |

```js
const merged = { ...defaults, ...overrides };   // later wins
const copy = [...arr, newItem];
Math.max(...nums);
```

### Gotchas
- Spread of objects copies own enumerable properties only; getters are invoked and prototypes dropped.
- Object spread of `null`/`undefined` is fine (`{...null}` → `{}`), but array spread of them throws.
- Spreading a string produces characters (by code point); `[..."👍"]` has length 1.
- Statement-level object destructuring assignment needs parentheses: `({ a } = obj);`.
- Defaults are evaluated lazily and can refer to earlier bindings: `const { a, b = a * 2 } = o`.

## Follow-ups
- **Is rest a deep copy?** — No, still shallow.
- **How do you avoid a key in the rest?** — `const { password, ...safe } = user`.

## Common Mistakes
- Expecting `null` to trigger a default.
- Mutating nested objects after a "copy" via spread.

## Tips
- Remember "left side collects (rest), right side expands (spread)".
