---
title: "Why is NaN !== NaN, and why is 0.1 + 0.2 !== 0.3?"
level: hard
type: concept
tags: [nan, numbers, floating-point, bigint, parseint]
related: [javascript/double-vs-triple-equals, javascript/type-coercion, javascript/data-types-typeof]
---

## Question
Explain these results and how you would handle each in production code:

```js
NaN === NaN;                    // ?
isNaN("abc"); Number.isNaN("abc"); // ?
0.1 + 0.2 === 0.3;              // ?
2 ** 53 === 2 ** 53 + 1;        // ?
["1", "2", "3"].map(parseInt);  // ?
```

## Clues
- All JS numbers are IEEE 754 double-precision floats: 64 bits, 52 for the fraction.
- `NaN` is defined by that standard to be unequal to everything, including itself.
- `map` passes `(value, index, array)` — what does `parseInt` do with a second argument?

## Interview Answer
JavaScript numbers are 64-bit IEEE 754 floats, and most of these come from that standard. `NaN` is the result of an invalid numeric operation, and IEEE 754 says it is unequal to everything including itself, so `NaN === NaN` is `false`; I detect it with `Number.isNaN`, because the global `isNaN` coerces first and reports `true` for `"abc"`. `0.1 + 0.2` is `0.30000000000000004` because 0.1 and 0.2 have no exact binary representation, so I compare floats within `Number.EPSILON`, or better, store money as integer paise. Above `Number.MAX_SAFE_INTEGER` (2⁵³ − 1) integers lose precision, so `2**53 === 2**53 + 1` is `true`; for large IDs I use strings or `BigInt`. Finally, `["1","2","3"].map(parseInt)` gives `[1, NaN, NaN]` because `map` passes the index as `parseInt`'s radix argument.

## Explanation
### NaN

```js
0 / 0;              // NaN
Number("12px");     // NaN
Math.sqrt(-1);      // NaN
typeof NaN;         // "number"

NaN === NaN;        // false
Number.isNaN(NaN);  // true
Number.isNaN("abc");// false — no coercion
isNaN("abc");       // true  — coerces "abc" to NaN first
Object.is(NaN, NaN);// true
[NaN].includes(NaN);// true (SameValueZero)
```

`NaN` is contagious: any arithmetic with it gives `NaN`. A single bad input can turn a cart total into `NaN` — validate at the boundary. `JSON.stringify` turns `NaN` and `Infinity` into `null`.

### Floating point

```txt
0.1 in binary = 0.0001100110011001100... (repeats forever)
stored rounded to 52 bits → tiny error
0.1 + 0.2 = 0.30000000000000004
```

```js
const nearlyEqual = (a, b) => Math.abs(a - b) < Number.EPSILON;
nearlyEqual(0.1 + 0.2, 0.3); // true
```

`Number.EPSILON` works for values around 1; for larger numbers scale the tolerance. For money, avoid the problem entirely: store `₹199.99` as `19999` paise and format with `Intl.NumberFormat` only for display. `toFixed` is for display too — `(1.005).toFixed(2)` is `"1.00"` because 1.005 is really 1.00499999….

### Safe integers and BigInt

```js
Number.MAX_SAFE_INTEGER;      // 9007199254740991 (2^53 - 1)
2 ** 53 === 2 ** 53 + 1;      // true — precision lost
Number.isSafeInteger(2 ** 53);// false

9007199254740993n + 1n;       // 9007199254740994n — exact
1n + 1;                       // TypeError: cannot mix BigInt and other types
```

Real-world case: a backend sends a 64-bit database ID as a JSON number; `JSON.parse` silently rounds it. Ask the API to send IDs as strings.

### `parseInt` vs `Number`

```js
["1", "2", "3"].map(parseInt);
// parseInt("1", 0) → 1   (radix 0 = default 10)
// parseInt("2", 1) → NaN (radix 1 is invalid)
// parseInt("3", 2) → NaN ("3" is not a binary digit)
["1", "2", "3"].map(Number); // [1, 2, 3]

parseInt("08px"); // 8 — parses the leading digits
Number("08px");   // NaN — whole string must be numeric
Number("");       // 0  — a classic form-validation bug
parseInt(0.0000005); // 5 — the number stringifies to "5e-7" first
```

Always pass a radix: `parseInt(str, 10)`.

### Signed zero and infinity

```js
0 === -0;          // true
Object.is(0, -0);  // false
1 / -0;            // -Infinity
Math.max();        // -Infinity (identity for max)
```

## Follow-ups
- **How do you sum money safely?** — Integers in the smallest unit (paise), or a decimal library for complex rates; format with `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`.
- **Why `Number.isInteger(5.0)` is true?** — There is no separate integer type; `5.0` and `5` are the same value.
- **When would you use BigInt in frontend code?** — Large IDs, cryptography, precise timestamps in nanoseconds. It cannot be mixed with numbers and is not JSON-serialisable by default.

## Common Mistakes
- Using global `isNaN`, which coerces its argument, so any non-numeric string reports `true` even though it is not the value `NaN`.
- Comparing floats with `===`.
- Storing currency as floats and rounding at the end.
- Calling `parseInt` without a radix, or passing it straight to `map`.

## Tips
- Anchor everything to "all numbers are 64-bit floats" — `NaN`, `0.1 + 0.2`, `MAX_SAFE_INTEGER` and `-0` all follow from it.
- Mention the money-in-paise pattern; it shows production experience.
