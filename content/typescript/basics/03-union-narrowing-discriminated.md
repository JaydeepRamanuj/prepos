---
title: "Union types, narrowing and discriminated unions"
level: medium
type: concept
tags: [union-types, narrowing, discriminated-unions, control-flow, tagged-unions]
related: [typescript/any-unknown-never, typescript/type-guards-predicates, react/use-reducer-vs-use-state]
---

## Question
How does TypeScript narrow union types? What is a discriminated union, why is it the preferred way to model state like `loading | success | error`, and how do you handle impossible states?

## Interview Answer
A union type means a value is one of several types, and TypeScript narrows it inside control flow when you check `typeof`, `instanceof`, equality, truthiness, `in`, or a discriminant property. A discriminated (tagged) union gives every member a common literal-typed property, such as `status: "success"`, so checking that one property narrows to the exact member, and the compiler knows which other fields exist. It's the best way to model state because it makes impossible combinations unrepresentable: with `{ loading: boolean; data?: T; error?: Error }` you can have `loading: false` with neither data nor error, but with a tagged union only valid shapes exist. Combined with an exhaustive `switch` and a `never` check, adding a new state forces every consumer to handle it.

## Explanation
### Basic narrowing

```ts
function format(x: string | number | null) {
  if (x === null) return "none";           // equality narrowing
  if (typeof x === "string") return x.trim();   // typeof narrowing
  return x.toFixed(2);                      // remaining: number
}

function len(x: string | string[]) {
  return Array.isArray(x) ? x.length : x.length;   // Array.isArray narrows
}

function describe(v: Date | RegExp) {
  return v instanceof Date ? v.toISOString() : v.source;   // instanceof
}

type Cat = { meow(): void };
type Dog = { bark(): void };
function speak(p: Cat | Dog) {
  if ("meow" in p) p.meow(); else p.bark();   // `in` narrowing
}
```

### Discriminated union

```ts
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function render(s: RequestState<string[]>) {
  switch (s.status) {
    case "idle":    return "Start";
    case "loading": return "…";
    case "success": return s.data.join(", ");     // s is the success member: data exists
    case "error":   return s.error.message;
    default: {
      const _never: never = s;                     // compile error if a case is missing
      return _never;
    }
  }
}
```

### Why it beats optional fields

```ts
// Weak: allows invalid combinations
type Bad<T> = { loading: boolean; data?: T; error?: Error };
const x: Bad<string> = { loading: false };         // neither data nor error: valid, but meaningless
```

With the tagged union that value is rejected.

### Other narrowing tools
- Truthiness (`if (user)`), optional chaining, `??`.
- Assignment narrowing: `let x: string | number = 1; x; // number`.
- User-defined type guards (see the type guards question).
- `Array.prototype.filter` with a type predicate: `items.filter((i): i is Item => i != null)`.
- Narrowing can be lost across function boundaries or callbacks for mutable variables; use `const`.

### Pitfalls
- Using non-literal discriminants (`status: string`) disables narrowing.
- Narrowing by comparing against a variable of type `string` doesn't narrow to a literal.
- Destructuring before narrowing loses correlation in older versions; modern TypeScript (4.6+) supports destructured discriminated unions when they're `const` parameters or consts.

## Follow-ups
- **Why use `never` in the default branch?** — It makes the switch exhaustive at compile time.
- **Where else do discriminated unions show up?** — Redux/useReducer actions, API result types (`Result<T, E>`), AST nodes.

## Common Mistakes
- Modelling states with several optional properties.
- Forgetting a `default` exhaustiveness check.

## Tips
- Use `useReducer` actions or API results as your example; it connects to React.
