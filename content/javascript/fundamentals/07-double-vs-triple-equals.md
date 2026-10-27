---
title: "What is the difference between ==, === and Object.is?"
level: medium
type: concept
tags: [equality, coercion, object-is, comparison]
related: [javascript/type-coercion, javascript/null-vs-undefined, javascript/nan-and-number-quirks]
---

## Question
Explain `==` vs `===`. What does `[] == ![]` evaluate to, and why? Where does `Object.is` fit in, and which algorithm do `includes`, `indexOf`, `Map` and `Set` use?

## Interview Answer
`===` is strict equality: different types are never equal, and there is no conversion. `==` is loose equality: if the types differ it converts them using fixed rules — `null` and `undefined` equal only each other, booleans become numbers, strings become numbers when compared with numbers, and objects are turned into primitives. That is how `[] == ![]` ends up `true`: `![]` is `false`, `false` becomes `0`, `[]` becomes `""` and then `0`, and `0 == 0`. `Object.is` is like `===` but fixes its two edge cases: `Object.is(NaN, NaN)` is `true` and `Object.is(0, -0)` is `false`. I use `===` everywhere, with `x == null` as the one deliberate exception for checking null-or-undefined.

## Explanation
### The loose equality algorithm (simplified)

```txt
x == y
├─ same type?             → compare like ===
├─ null vs undefined      → true   (and nothing else equals them)
├─ number vs string       → ToNumber(string), compare
├─ boolean vs anything    → ToNumber(boolean), restart
├─ object vs primitive    → ToPrimitive(object), restart
└─ otherwise              → false
```

### `[] == ![]` step by step

```txt
[] == ![]
[] == false        ! converts [] to boolean: [] is truthy → false
[] == 0            boolean → number
"" == 0            object → primitive ([].toString() is "")
0  == 0            string → number
true
```

### Surprising results

```js
null == 0;          // false — null only equals null/undefined
null >= 0;          // true  — relational ops DO convert null to 0
"" == 0;            // true
"0" == false;       // true  ("0" → 0, false → 0)
[0] == false;       // true
NaN == NaN;         // false
```

The `"0" == false` case is nasty: `"0"` is truthy in `if`, yet loosely equals `false`.

### Three equality algorithms

| Algorithm | Used by | `NaN` vs `NaN` | `0` vs `-0` |
|---|---|---|---|
| Strict (`===`) | `===`, `indexOf`, `lastIndexOf`, `switch` | false | true |
| SameValueZero | `includes`, `Map`/`Set` keys | **true** | true |
| SameValue (`Object.is`) | `Object.is`, React state comparison | **true** | **false** |

```js
[NaN].indexOf(NaN);   // -1
[NaN].includes(NaN);  // true
new Set([NaN, NaN]).size; // 1
```

React uses `Object.is` to decide whether a state update or an effect dependency changed — so setting state to `NaN` again is treated as "no change", while `0` → `-0` counts as a change.

### Objects compare by reference under all three

```js
({}) === ({});        // false
const a = [1];
a == "1";             // true — a becomes "1"
```

## Follow-ups
- **Why is `x == null` acceptable?** — It is exactly `x === null || x === undefined`, with no other coercion, so it is concise and safe. Many lint configs allow it (`eqeqeq: ["error", "smart"]`).
- **How do you compare two objects by value?** — There is no built-in; compare keys recursively, or use a library like `fast-deep-equal`. `JSON.stringify` comparison breaks on key order and non-JSON values.
- **Does `switch` use `==`?** — No, it uses strict equality.

## Common Mistakes
- Saying `==` "just compares values without types" — it follows a specific conversion algorithm.
- Believing `===` handles `NaN`; it never matches itself.
- Assuming `includes` and `indexOf` behave the same.

## Tips
- Walk `[] == ![]` out loud step by step — interviewers ask it to see whether you know the algorithm, not to hear "JavaScript is weird".
- Mention React's use of `Object.is` to connect language trivia to real work.
