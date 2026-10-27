---
title: "Generic functions and constraints: when and how to use extends"
level: medium
type: concept
tags: [generics, constraints, extends, inference, type-parameters]
related: [typescript/keyof-indexed-access, typescript/generic-defaults-inference, typescript/generic-components]
---

## Question
What problem do generics solve? Show a generic function with a constraint, explain how inference picks type arguments, and say when a generic is unnecessary.

## Interview Answer
Generics let a function or type work with many types while preserving the relationship between inputs and outputs. `function first<T>(xs: T[]): T | undefined` returns the element type of whatever array it gets, where `any` would lose that link. A constraint `T extends { id: string }` restricts what's allowed while still keeping the specific type, so I can read `.id` and return the full `T`. TypeScript infers type arguments from the call, so I rarely write them explicitly. A generic is justified when the type parameter appears at least twice (input and output, or two inputs that must match); if it appears only once, a plain type is usually simpler, such as `(x: unknown) => void` instead of `<T>(x: T) => void`. I keep constraints as narrow as the function's actual needs.

## Explanation
### From `any` to generics

```ts
function firstAny(xs: any[]): any { return xs[0]; }            // loses type info
function first<T>(xs: readonly T[]): T | undefined { return xs[0]; }

const n = first([1, 2, 3]);        // number | undefined (T inferred as number)
const s = first(["a", "b"]);       // string | undefined
```

### Constraints

```ts
function byId<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((i) => i.id === id);          // can read .id
}

const users = [{ id: "u1", name: "Asha" }];
const u = byId(users, "u1");                      // u: { id: string; name: string } | undefined
```

Without the generic (`items: { id: string }[]`) the return type would lose `name`.

### Multiple parameters and relationships

```ts
function merge<A extends object, B extends object>(a: A, b: B): A & B {
  return { ...a, ...b };
}

function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((i) => i[key]);
}
const names = pluck([{ id: 1, name: "a" }], "name");   // string[]
```

### Inference rules in brief
- Inferred from arguments; candidates from multiple positions are unioned or the first wins depending on variance.
- Return-type position can infer from the contextual type (`const x: Set<string> = new Set()`).
- Provide explicit type arguments when inference fails: `useState<User | null>(null)`.
- Defaults and constraints interplay: `T extends string = string`.

### When a generic is unnecessary

```ts
// Bad: T used once
function log<T>(x: T): void { console.log(x); }
// Better
function log(x: unknown): void { console.log(x); }

// Bad: constraint says it all
function getId<T extends { id: string }>(x: T): string { return x.id; }
// Better
function getId(x: { id: string }): string { return x.id; }
```

Rule of thumb ("if a type parameter appears only once, it probably shouldn't exist").

### Common patterns
- `Promise<T>`, `Array<T>`, `Map<K, V>` built-ins.
- Higher-order functions: `function memo<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R`.
- Constrain to function types for wrappers; use `Parameters<T>` and `ReturnType<T>` utilities.

### Pitfalls
- Over-constraining (`T extends string` when `string | number` should work).
- Casting inside generic functions (`as T`) hides errors.
- Unions distribute in some contexts (conditional types), not in plain generics.
- Default parameter values in generic functions often need a cast: avoid by overloads.

## Follow-ups
- **`T extends keyof U` vs `K in keyof T`?** — The first is a constraint on a type parameter; the second is mapped-type iteration syntax.
- **Generic arrow functions in `.tsx`?** — Write `<T,>(x: T) => x` or `<T extends unknown>` to avoid JSX ambiguity.

## Common Mistakes
- Using `any` where a generic would keep information.
- Adding type parameters that appear once.

## Tips
- Cite the "used twice" rule when asked if a generic is needed.
