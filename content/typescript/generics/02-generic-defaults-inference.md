---
title: "Generic defaults, inference and const type parameters"
level: medium
type: concept
tags: [generics, defaults, inference, const-type-parameters, NoInfer]
related: [typescript/generic-functions-constraints, typescript/const-assertions-and-literals, typescript/generic-inference-pitfalls]
---

## Question
How do default type parameters work? What do `const` type parameters (TypeScript 5.0) and `NoInfer` (5.4) change about inference, and when would you want them?

## Interview Answer
A default (`<T = string>`) is used when the type argument isn't provided and can't be inferred, which is useful for generic interfaces and component props such as `Props<T = {}>`. Inference normally widens literal arguments, so `identity(["a", "b"])` infers `string[]`; a `const` type parameter (`<const T>`) asks the compiler to infer the narrowest, readonly literal type as if `as const` was written, so `["a", "b"]` becomes `readonly ["a", "b"]`, which is great for config and route definitions. `NoInfer<T>` marks an argument as a non-inference site, so a parameter that should be checked against `T` doesn't also influence what `T` becomes; this prevents defaults or fallback arguments from widening the inferred type. I use these to make APIs accurate without forcing callers to write `as const` or type arguments.

## Explanation
### Defaults

```ts
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

const r: ApiResponse = { data: 123, status: 200 };         // T defaults to unknown
const s: ApiResponse<string> = { data: "x", status: 200 };

function createStore<S extends object = {}>(initial?: S) { /* … */ }
```

Rules: defaults must come after required parameters; a default must satisfy the constraint (`T extends object = {}`). Defaults apply when no inference candidates exist.

### Inference widening vs `const`

```ts
function defineRoutes<T extends readonly string[]>(routes: T): T { return routes; }
const a = defineRoutes(["home", "about"]);               // T: string[]

function defineRoutesC<const T extends readonly string[]>(routes: T): T { return routes; }
const b = defineRoutesC(["home", "about"]);              // T: readonly ["home", "about"]

type Route = (typeof b)[number];                          // "home" | "about"
```

The `const` modifier applies to literal expressions passed directly; for variables it has no effect. For mutable array constraints (`T extends string[]`) the inferred readonly tuple fails the constraint, so constrain with `readonly string[]`.

### `NoInfer`

```ts
function pick<T extends string>(options: T[], initial: NoInfer<T>): T {
  return initial;
}

pick(["a", "b"], "a");        // OK, T = "a" | "b"
// pick(["a", "b"], "c");     // error: "c" is not assignable to "a" | "b"
```

Without `NoInfer`, `"c"` would also be an inference candidate and `T` would become `"a" | "b" | "c"`, silently accepting the mistake.

### Inference tips
- Inference sources: arguments, return-type context, and default values.
- Multiple candidates: covariant positions produce unions (or best common supertype); contravariant positions (function parameters) produce intersections.
- Use overloads or conditional types if inference can't express a relationship.
- Prefer inferring from one "primary" argument and checking others with `NoInfer`.
- Explicit type arguments partially specified aren't allowed (all or nothing) unless defaults fill in, which is why defaults help builder-style APIs.

### Example: typed event emitter

```ts
type Events = { login: { userId: string }; logout: undefined };

function on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void) {}

on("login", (p) => p.userId);     // p inferred from K = "login"
```

### Example: a builder with defaults

```ts
class QueryBuilder<Row = unknown, Selected extends keyof Row = keyof Row> {
  select<K extends keyof Row>(...cols: K[]): QueryBuilder<Row, K> { return this as never; }
}
```

## Follow-ups
- **When does a default apply instead of inference?** — Only when there are no inference candidates.
- **Does `const T` make the value immutable at runtime?** — No, type-level only.

## Common Mistakes
- Giving a default that violates the constraint.
- Using `const` type parameters with mutable array constraints.

## Tips
- Name TS 5.0 `const` parameters and 5.4 `NoInfer`; they show current knowledge.
