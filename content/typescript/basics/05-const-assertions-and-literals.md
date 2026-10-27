---
title: "Literal types, as const and enums vs union types"
level: medium
type: concept
tags: [literal-types, as-const, enums, readonly, union-of-literals]
related: [typescript/satisfies-operator, typescript/union-narrowing-discriminated, typescript/mapped-types]
---

## Question
What does `as const` do? How do you derive a union type from a constant array or object, and when would you choose a union of string literals over an `enum`?

## Interview Answer
Without `as const`, TypeScript widens literals: `const roles = ["admin", "user"]` is `string[]`. Adding `as const` freezes the type to the most specific literal, readonly form: `readonly ["admin", "user"]`, and object properties become readonly literal types. That lets you derive types from a single runtime source of truth, such as `type Role = typeof roles[number]`, so the list and the type can't drift apart. I prefer unions of string literals (or `as const` objects) over TypeScript `enum`s: they're erasable (no extra runtime code), work with plain strings and JSON, are structurally compatible, and are supported by Node's type-stripping and `--erasableSyntaxOnly`, while `enum` generates runtime objects, numeric enums are loosely typed, and enums have nominal quirks. Use `enum` mainly when interoperating with existing code or when you want reverse mapping.

## Explanation
### Widening vs literals

```ts
const a = "x";            // type "x" (const keeps the literal)
let b = "x";              // type string (widened)
const obj = { mode: "dark" };           // { mode: string }
const obj2 = { mode: "dark" } as const; // { readonly mode: "dark" }
```

### Deriving types from values

```ts
export const ROLES = ["admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];     // "admin" | "editor" | "viewer"

export const STATUS = {
  Idle: "idle",
  Loading: "loading",
  Error: "error",
} as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];   // "idle" | "loading" | "error"

function isRole(x: string): x is Role {
  return (ROLES as readonly string[]).includes(x);
}
```

Single source of truth: add a role to the array and the type updates; use the array at runtime (select options, validation).

### `as const` details
- Arrays become readonly tuples with literal elements.
- Nested objects become deeply readonly.
- Only works on literal expressions (not on variables or function calls).
- `as const` on a function result doesn't work; use `satisfies` or annotations.

### Enums

```ts
enum Direction { Up, Down }          // numeric: Direction.Up === 0, reverse mapping exists
enum Color { Red = "RED", Green = "GREEN" }   // string enum: no reverse mapping

const enum Flag { A, B }             // inlined at compile time; problematic with isolatedModules/transpilers
```

Problems: they emit runtime code, numeric enums accept any number (before TS 5.0), string enums are nominal (a plain `"RED"` isn't assignable), `const enum` can break with Babel/SWC/esbuild and `isolatedModules`, and enums aren't erasable syntax.

| | Union of literals / `as const` object | `enum` |
|---|---|---|
| Runtime output | none (type) / plain object | an object |
| Assignable from string literal | yes | no (string enums) |
| Works in type-stripping runtimes | yes | no |
| Reverse mapping | no | numeric enums |
| Iterate values | `Object.values(STATUS)` | `Object.values(Color)` (with caveats) |

### Practical tips
- For domain constants prefer `as const` objects plus a derived union.
- Use a `satisfies` check to validate shape without widening (see the `satisfies` question).
- With `--erasableSyntaxOnly` (TypeScript 5.8+) enums and parameter properties are errors, aligning with Node's built-in type stripping.
- Template literal types can combine literal unions to build string unions from other unions (see the template literal types question).

### Literal inference gotcha

```ts
function setMode(mode: "light" | "dark") {}
const m = "dark";         // type "dark"
setMode(m);               // OK
let n = "dark";           // string
// setMode(n);            // error: string not assignable
const cfg = { mode: "dark" };
// setMode(cfg.mode);     // error: widened to string; fix with `as const` or annotate
```

## Follow-ups
- **`readonly string[]` vs `string[]`?** — `readonly` arrays can't be mutated; a mutable array isn't assignable from a readonly one.
- **Does `as const` freeze at runtime?** — No; it's compile-time only. Use `Object.freeze` for runtime.

## Common Mistakes
- Maintaining a union and an array separately.
- Using `const enum` with a transpiler that doesn't support it.

## Tips
- Mention single source of truth and erasable syntax.
