---
title: "Conditional types and infer: distribution, ReturnType, unwrapping and type-level logic"
level: hard
type: concept
tags: [conditional-types, infer, distributive, ReturnType, recursion]
related: [typescript/mapped-types, typescript/utility-types, typescript/implement-utility-types]
---

## Question
Explain `T extends U ? X : Y`, how `infer` extracts types, what "distributive" means, and how to prevent distribution. Implement `ReturnType`, `Unwrap<T>` (unwraps arrays and promises) and `FunctionKeys<T>`.

## Clues
- Conditional types distribute over naked type parameters that are unions.
- `infer R` declares a type variable inside the `extends` clause that TypeScript fills in.
- Wrapping both sides in a tuple `[T] extends [U]` disables distribution.

## Interview Answer
A conditional type picks one of two types based on whether `T` is assignable to `U`. Inside the `extends` clause, `infer R` introduces a variable that TypeScript solves from the matched structure, which is how `ReturnType<F>` is written: `F extends (...args: any) => infer R ? R : never`. When the checked type is a naked type parameter and the argument is a union, the conditional distributes over each member, so `ToArray<string | number>` becomes `string[] | number[]`; wrapping in `[T] extends [U]` stops that. Conditional types can be recursive, letting me write `Unwrap<T>` that peels arrays and promises until it reaches a plain type. They power `Exclude`, `Extract`, `NonNullable`, `Awaited` and most advanced library typings.

## Explanation
### Basics and infer

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<"x">;     // true
type B = IsString<number>;  // false

type MyReturnType<F> = F extends (...args: any[]) => infer R ? R : never;
type MyParameters<F> = F extends (...args: infer P) => any ? P : never;
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type PromiseValue<T> = T extends Promise<infer V> ? V : T;

type R = MyReturnType<() => Date>;          // Date
type E = ElementOf<string[]>;               // string
```

### Distribution

```ts
type ToArray<T> = T extends unknown ? T[] : never;
type D = ToArray<string | number>;          // string[] | number[]   (distributes)

type ToArrayNoDist<T> = [T] extends [unknown] ? T[] : never;
type ND = ToArrayNoDist<string | number>;   // (string | number)[]

// Exclude is just a distributive conditional
type MyExclude<T, U> = T extends U ? never : T;
type X = MyExclude<"a" | "b" | "c", "a">;   // "b" | "c"
```

`never` as the checked type distributes over zero members and yields `never`: `ToArray<never>` is `never`. Use `[T] extends [never]` to test for `never`.

### Recursive unwrap

```ts
type Unwrap<T> =
  T extends Promise<infer U> ? Unwrap<U> :
  T extends readonly (infer E)[] ? Unwrap<E> :
  T;

type U1 = Unwrap<Promise<number[]>>;        // number
type U2 = Unwrap<Promise<Promise<string>>>; // string
```

### Keys of a given kind

```ts
type FunctionKeys<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

class Api { url = "/"; get() {} post() {} }
type Methods = FunctionKeys<Api>;           // "get" | "post"
```

### `infer` with constraints and multiple positions (TS 4.7+ `infer X extends Y`)

```ts
type FirstString<T> = T extends [infer H extends string, ...unknown[]] ? H : never;
type F = FirstString<["a", 1]>;             // "a"

type Swap<T> = T extends [infer A, infer B] ? [B, A] : never;
type S = Swap<[string, number]>;            // [number, string]
```

Multiple `infer` sites of the same variable in covariant positions union; in contravariant positions intersect.

### Practical examples
- `type Fn = (...a: any[]) => any; type AsyncReturn<F extends Fn> = Awaited<ReturnType<F>>`.
- Extract props of a component: `T extends React.ComponentType<infer P> ? P : never`.
- Typed route params from a path string: combine with template literal types.
- Overload resolution: `ReturnType` of overloaded functions takes the last signature.

### Pitfalls
- Unintended distribution (usually when you wanted to treat a union as a whole).
- Deferred conditional types: with unresolved generics, TS can't evaluate, so assignability inside generic functions often needs a cast.
- Deep recursion limits (~50 levels, higher with tail-recursive patterns).
- Error messages become opaque; hover and simplify with helper aliases.

## Follow-ups
- **What does `Awaited<T>` do beyond Promise?** — It recursively unwraps thenables, which is why `await` result types are accurate.
- **How do you check for `any`?** — `0 extends 1 & T ? true : false`.

## Common Mistakes
- Not realising `T extends U` distributes only for naked type parameters.
- Using conditional types where overloads or generics would be simpler.

## Tips
- Show the distribution example (`ToArray`) and the tuple escape hatch.
