---
title: "How does type coercion work? Predict these expressions"
level: hard
type: output
tags: [coercion, toprimitive, valueof, tostring, operators]
related: [javascript/double-vs-triple-equals, javascript/data-types-typeof, javascript/nan-and-number-quirks]
---

## Question
What does each line log?

```js
console.log([] + []);
console.log([] + {});
console.log(1 + "2" - 1);
console.log(true + 1);
console.log(null + 1, undefined + 1);
console.log([1, 2] + [3]);
console.log("b" + "a" + +"a" + "a");

const price = {
  valueOf() { return 42; },
  toString() { return "₹42"; },
};
console.log(price + 1, `${price}`, price + "");
```

Explain the rules that produce these results.

## Clues
- Objects must first become primitives. Which method is tried first depends on the "hint": number, string or default.
- Binary `+` concatenates if *either* side is a string after conversion; every other arithmetic operator converts to numbers.
- Unary `+` is `Number(x)`.

## Interview Answer
The output is `""`, `"[object Object]"`, `11`, `2`, `1 NaN`, `"1,23"`, `"baNaNa"`, and `43 ₹42 42`. Coercion has two steps: an object is first converted to a primitive through `ToPrimitive`, which calls `Symbol.toPrimitive` if present, otherwise `valueOf` then `toString` (or the reverse for a string hint). Then the operator decides: binary `+` concatenates if either primitive is a string, otherwise it adds numbers; `-`, `*`, `/` and unary `+` always convert to numbers. Arrays have a useless `valueOf` (returns the array itself), so they fall through to `toString`, which joins elements with commas — that is why `[] + []` is an empty string. Template literals use the string hint, so `${price}` calls `toString`, while `price + ""` uses the default hint, which for ordinary objects behaves like number and calls `valueOf`.

## Explanation
### Step 1 — ToPrimitive

```txt
object ──► has [Symbol.toPrimitive]? ──yes──► call it with hint
              │ no
              ▼
   hint "string"            hint "number" / "default"
   toString() → valueOf()   valueOf() → toString()
   (first one that returns a primitive wins)
```

| Context | Hint |
|---|---|
| `` `${x}` ``, `String(x)`, property key | string |
| `+x`, `x - 1`, `x * 2`, `x < y` | number |
| `x + y`, `x == y` | default (treated as number, except `Date` → string) |

Plain objects: `valueOf()` returns the object itself (not a primitive), so `toString()` gives `"[object Object]"`. Arrays: `toString()` is `join(",")`.

### Step 2 — the operator

- **Binary `+`**: if either side is a string → concatenate; else → numeric add.
- **Everything else arithmetic**: `ToNumber` on both sides.
- `ToNumber`: `""→0`, `" 12 "→12`, `"12px"→NaN`, `true→1`, `false→0`, `null→0`, `undefined→NaN`, `[]→0`, `[5]→5`, `[1,2]→NaN`.

### Walking through each line

| Expression | Steps | Result |
|---|---|---|
| `[] + []` | `"" + ""` | `""` |
| `[] + {}` | `"" + "[object Object]"` | `"[object Object]"` |
| `1 + "2" - 1` | `"12" - 1` → `12 - 1` | `11` |
| `true + 1` | `1 + 1` | `2` |
| `null + 1` | `0 + 1` | `1` |
| `undefined + 1` | `NaN + 1` | `NaN` |
| `[1,2] + [3]` | `"1,2" + "3"` | `"1,23"` |
| `"b" + "a" + +"a" + "a"` | `+"a"` is `NaN` → `"ba" + "NaN" + "a"` | `"baNaNa"` |
| `price + 1` | default hint → `valueOf` → `42 + 1` | `43` |
| `` `${price}` `` | string hint → `toString` | `"₹42"` |
| `price + ""` | default hint → `valueOf` → `"42"` | `"42"` |

### Controlling it with `Symbol.toPrimitive`

```js
const temp = {
  [Symbol.toPrimitive](hint) {
    return hint === "number" ? 36.6 : "36.6°C";
  },
};
+temp;       // 36.6
`${temp}`;   // "36.6°C"
temp + "";   // "36.6°C" — hint is "default", not "number"
```

### Explicit conversion in real code
Prefer `Number(x)`, `String(x)`, `Boolean(x)` over relying on operators. For user input, `Number("")` is `0`, which is often wrong — validate empty strings first. `parseInt("08px")` is `8` (parses a prefix) while `Number("08px")` is `NaN` (all or nothing).

## Follow-ups
- **Why can `{} + []` evaluate to `0`?** — When it is parsed as a statement (for example `eval("{} + []")`), the leading `{}` is an empty block, leaving `+[]`, which is `0`. As an expression, `({} + [])` is `"[object Object]"`. Modern DevTools consoles wrap input as an expression, so you usually see the latter.
- **Why does `new Date() + 1` give a string?** — `Date` treats the default hint as string, so it concatenates; `new Date() - 0` gives the timestamp.
- **Which values are falsy?** — `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. Everything else, including `[]`, `{}` and `"0"`, is truthy.

## Common Mistakes
- Assuming `+` with an object calls `toString` first — the default hint tries `valueOf` first.
- Forgetting that `-`, `*`, `/` never concatenate.
- Treating `[]` as falsy because it is "empty".

## Tips
- Memorise the two-step model (ToPrimitive, then operator rule) instead of memorising snippets — it solves every variant.
- "`+` is the only operator that loves strings" is a quick mnemonic.
