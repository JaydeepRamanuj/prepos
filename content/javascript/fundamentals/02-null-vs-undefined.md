---
title: "What is the difference between null and undefined?"
level: easy
type: concept
tags: [null, undefined, nullish-coalescing, optional-chaining]
related: [javascript/data-types-typeof, javascript/double-vs-triple-equals, javascript/destructuring-spread-edge-cases]
---

## Question
What is the difference between `null` and `undefined`? When does JavaScript produce each, and how do `??`, `||` and `?.` treat them?

## Interview Answer
`undefined` means "no value has been assigned" and is what the language gives you automatically: an uninitialised variable, a missing property, a missing argument, or a function with no `return`. `null` means "intentionally empty" and only appears when a developer or an API puts it there. They are loosely equal to each other (`null == undefined` is true) but not strictly equal, and `typeof null` is `"object"` while `typeof undefined` is `"undefined"`. In practice they behave differently in a few places: default parameters and destructuring defaults kick in only for `undefined`, `JSON.stringify` drops `undefined` properties but keeps `null`, and in arithmetic `null` becomes `0` while `undefined` becomes `NaN`. For fallbacks I use `??`, which treats both as "missing" but keeps valid falsy values like `0` and `""`.

## Explanation
### Where each one comes from

```js
let a;                 // undefined — declared, not assigned
const o = {};
o.missing;             // undefined — property does not exist
function f(x) { return x; }
f();                   // undefined — argument not passed
(() => {})();          // undefined — no return value

document.getElementById("nope"); // null — API says "nothing found"
const user = { manager: null };  // null — "known to be empty"
```

A useful convention: **never assign `undefined` yourself**; use `null` when you mean "empty on purpose". Then `undefined` always signals "not set".

### Where they behave differently

| | `undefined` | `null` |
|---|---|---|
| `typeof` | `"undefined"` | `"object"` |
| `Number(x)` | `NaN` | `0` |
| Default param / destructuring default | default applies | default **not** applied |
| `JSON.stringify({ a: x })` | `"{}"` | `'{"a":null}'` |

```js
function greet(name = "guest") { return name; }
greet(undefined); // "guest"
greet(null);      // null  — default skipped!

const { size = 10 } = { size: null }; // size === null
```

That default-parameter rule is a real-world bug source: APIs that send `null` bypass your defaults.

### Checking for "either one"

```js
value == null       // true for null and undefined only — the one accepted use of ==
value ?? "fallback" // fallback only if null/undefined
user?.address?.city // short-circuits to undefined if any link is null/undefined
```

### `??` vs `||`

```js
0 || 10;   // 10 — || falls back on ANY falsy value
0 ?? 10;   // 0  — ?? falls back only on null/undefined
"" ?? "x"; // ""
```

Use `??` for config values, counts and form inputs where `0`, `""` and `false` are legitimate.

## Follow-ups
- **What does `null == 0` return?** — `false`. Loose equality treats `null` as equal only to `null` and `undefined`, even though `null >= 0` is `true` (relational operators convert `null` to `0`).
- **Can you mix `??` with `||` without parentheses?** — No, `a || b ?? c` is a SyntaxError; you must group explicitly.
- **What is `void 0`?** — An expression that always evaluates to `undefined`; minifiers use it because it is shorter and cannot be shadowed.

## Common Mistakes
- Using `||` for defaults and silently replacing a valid `0` or empty string.
- Expecting a default parameter to replace `null`.
- Checking `if (!value)` when you only mean "missing" — it also rejects `0`, `""` and `false`.

## Tips
- One-liner: "`undefined` is the language saying *not set*; `null` is the programmer saying *empty on purpose*."
- Mention `x == null` as the single idiomatic use of `==` — interviewers like hearing you know when the rule can be broken.
