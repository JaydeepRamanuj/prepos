---
title: "Comparison and toPrimitive puzzles: [] == ![], null >= 0 and Symbol.toPrimitive"
level: hard
type: output
tags: [coercion, equality, comparison, symbol-toprimitive, output]
related: [javascript/type-coercion, javascript/double-vs-triple-equals, javascript/symbols-well-known]
---

## Question
What does this log?

```js
console.log([] == ![]);
console.log(null == 0, null >= 0, null > 0);
console.log(undefined == null, undefined >= 0);
console.log("10" < "9", 10 < "9");
console.log([10, 1, 2].sort());

const temp = {
  [Symbol.toPrimitive](hint) {
    console.log("hint:", hint);
    return hint === "number" ? 25 : "25°C";
  },
};
console.log(+temp);
console.log(`${temp}`);
console.log(temp + 1);
console.log(temp > 20);
```

## Clues
- `==` and the relational operators (`<`, `>=`) follow **different** algorithms. `null` is special in one and not in the other.
- `!` converts to boolean before anything else, and every object, including `[]`, is truthy.
- `Symbol.toPrimitive` receives a hint: `"number"`, `"string"` or `"default"`. Which operator sends which?

## Interview Answer
The output is `true`, `false true false`, `true false`, `true false`, `[ 1, 10, 2 ]`, and then each `temp` line prints its hint first: `number` and `25`, `string` and `25°C`, `default` and `25°C1`, `number` and `true`. `![]` is `false` because arrays are truthy, so the comparison becomes `[] == false`. Both sides convert to numbers: `[]` becomes `""` and then `0`, and `false` becomes `0`, so it is `true`. `null == 0` is false because loose equality only matches `null` with `undefined`, but `>=` converts `null` to `0`, so `null >= 0` is true. Two strings compare character by character, a number against a string compares numerically, and `sort()` compares as strings by default. `Symbol.toPrimitive` gets the hint `"number"` for unary plus and relational comparison, `"string"` for template literals, and `"default"` for `+`.

## Explanation
### Exact output

```txt
true
false true false
true false
true false
[ 1, 10, 2 ]
hint: number
25
hint: string
25°C
hint: default
25°C1
hint: number
true
```

### `[] == ![]` gives `true`
1. `![]`: `[]` is an object, so it is truthy, and the result is `false`.
2. `[] == false`: when one side is a boolean, it becomes a number, so this is `[] == 0`.
3. Object compared with a number: the object becomes a primitive. `[].valueOf()` is the array itself (not primitive), so `toString()` gives `""`, which makes it `"" == 0`.
4. String compared with a number: `""` becomes `0`, and `0 == 0` is `true`.

### `null`: equality vs relational

| Expression | Algorithm | Result |
|---|---|---|
| `null == 0` | loose equality: `null` equals only `null`/`undefined` | `false` |
| `null >= 0` | relational: `ToNumber(null)` is `0`, so `0 >= 0` | `true` |
| `null > 0` | `0 > 0` | `false` |
| `undefined == null` | special case in `==` | `true` |
| `undefined >= 0` | `ToNumber(undefined)` is `NaN`, and every comparison with `NaN` is false | `false` |

So `null >= 0` is true while both `null > 0` and `null == 0` are false. It is the textbook example of why `==` and `>=` are not consistent.

### Strings vs numbers in `<`
- `"10" < "9"`: both are strings, so they compare by UTF-16 code units. `"1"` (49) < `"9"` (57) gives `true`.
- `10 < "9"`: mixed, so the string becomes a number, and `10 < 9` gives `false`.
- `[10, 1, 2].sort()` gives `[1, 10, 2]`. With no comparator, `sort` converts elements to strings and compares them that way. Always pass `(a, b) => a - b` for numbers.

### `Symbol.toPrimitive` and hints

| Operation | Hint |
|---|---|
| `+obj`, `obj > 20`, `Math.max(obj)` | `"number"` |
| `` `${obj}` ``, `String(obj)`, property key `o[obj]` | `"string"` |
| `obj + 1`, `obj == 1` | `"default"` |

So `temp + 1` returns `"25°C"` for the default hint, and `+` with a string operand concatenates, giving `"25°C1"`. Without `Symbol.toPrimitive`, the engine tries `valueOf` then `toString` for the number/default hints, and the reverse for the string hint. (`Date` is the exception: it treats `"default"` like `"string"`.)

## Follow-ups
- **How do you safely check for both `null` and `undefined`?** — `value == null` is the one widely accepted use of `==`. Or use `value ?? fallback` for defaults.
- **How does `Object.is` differ from `===`?** — `Object.is(NaN, NaN)` is `true` and `Object.is(0, -0)` is `false`. Otherwise it is the same. React uses `Object.is` to compare state.
- **What does `[] + {}` give?** — `"[object Object]"`, because both become strings and get concatenated.

## Common Mistakes
- Assuming `[]` is falsy because it is "empty". All objects are truthy, including `[]`, `{}` and `new Boolean(false)`.
- Assuming `null >= 0` follows from `null == 0`. They use different algorithms.
- Calling `.sort()` on numbers without a comparator.

## Tips
- Walk through `[] == ![]` as four numbered conversion steps. Interviewers want to see the algorithm, not a memorised answer.
