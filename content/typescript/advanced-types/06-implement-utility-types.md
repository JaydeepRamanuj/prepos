---
title: "Implement DeepPartial, DeepReadonly, PartialBy, RequireAtLeastOne and a type-level test"
level: advanced
type: implement
tags: [utility-types, recursion, mapped-types, conditional-types, type-testing]
related: [typescript/mapped-types, typescript/conditional-types-infer, typescript/utility-types]
---

## Question
Implement these utility types and verify them with compile-time assertions:

1. `DeepPartial<T>`: makes all nested properties optional (arrays handled).
2. `PartialBy<T, K>`: makes only keys `K` optional.
3. `RequireAtLeastOne<T>`: at least one property of `T` must be provided.
4. `Prettify<T>`: flattens an intersection for readable hovers.
5. An `Equals<A, B>` helper for testing types.

```ts
type Settings = { theme: { dark: boolean; font: string }; tags: string[]; name: string };
type P = DeepPartial<Settings>;                 // { theme?: { dark?: boolean; font?: string }; tags?: string[]; name?: string }
```

## Clues
- Recursion happens inside the mapped type's value position.
- `Omit<T, K> & Partial<Pick<T, K>>` builds `PartialBy`, but needs `Prettify` to display well.
- `RequireAtLeastOne` is a mapped type that produces a union of "this key is required" variants.

## Interview Answer
For `DeepPartial` I use a homomorphic mapped type with a `?` modifier and recurse when the property is an object, handling arrays and functions explicitly so they aren't mangled. `PartialBy<T, K>` is `Prettify<Omit<T, K> & Partial<Pick<T, K>>>`. `RequireAtLeastOne` maps over each key and builds a variant where that key is required and the others optional, then indexes the mapped type by its keys to form a union. `Prettify` re-maps an intersection through `{ [K in keyof T]: T[K] } & {}` to flatten it. To test them I use an `Equals` type based on the identity-of-function trick and assertions that fail compilation when the types differ. This demonstrates mapped types, conditional types, recursion and distributivity together.

## Explanation
### Implementations

```ts
type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type DeepPartial<T> =
  T extends Primitive | ((...args: any[]) => unknown) ? T :
  T extends readonly (infer E)[] ? DeepPartial<E>[] :
  T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } :
  T;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type PartialBy<T, K extends keyof T> = Prettify<Omit<T, K> & Partial<Pick<T, K>>>;

type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];
```

### Usage

```ts
type User = { id: string; name: string; email: string };

type Draft = PartialBy<User, "email">;             // { id: string; name: string; email?: string }

type Contact = RequireAtLeastOne<{ email: string; phone: string }>;
const ok1: Contact = { email: "a@b.c" };
const ok2: Contact = { phone: "123" };
// const bad: Contact = {};                         // error
```

### Type-level tests

```ts
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type _t1 = Expect<Equals<DeepPartial<{ a: { b: number } }>, { a?: { b?: number } }>>;
type _t2 = Expect<Equals<PartialBy<User, "email">, { id: string; name: string; email?: string }>>;
type _t3 = Expect<Equals<Prettify<{ a: 1 } & { b: 2 }>, { a: 1; b: 2 }>>;
// If a definition regresses, the line above fails to compile.
```

`Equals` uses the compiler's internal identity relation, so it distinguishes `any`, `readonly`, optionality and intersections from structural lookalikes. Libraries use it (type-fest, Vitest `expectTypeOf`, `tsd`).

### Detailed notes
- **Arrays**: `DeepPartial<string[]>` maps to `DeepPartial<string>[]`; without the array branch the generic mapped type would turn arrays into objects with optional numeric keys (TypeScript homomorphic mapped types preserve arrays/tuples, but explicit handling is clearer for readonly arrays).
- **Functions and class instances**: treat functions as leaves; `Date`, `Map`, `Set` often should also be leaves:

```ts
type Leaf = Primitive | Date | RegExp | Map<any, any> | Set<any> | ((...args: any[]) => unknown);
```

- **`& {}`** in `Prettify` forces TS to display the resolved object rather than the alias; it also prevents `null`/`undefined` weirdness for primitives.
- **`RequireAtLeastOne`** works for object types with finite keys; the result is a union with one variant per key, so excess property checks apply per variant.
- **Optional modifiers**: `-?` in the helper ensures optional input keys are included in the union.

### Complexity and limits
Recursive types cost compile time on huge types; TypeScript caps instantiation depth (~50, 100 for tail recursion). Avoid deep recursion on large API models.

## Follow-ups
- **Why `Omit<T, K> & Partial<Pick<T, K>>` instead of one mapped type?** — Because making a subset of keys optional while keeping the rest requires combining two views of the type.
- **Can you write `DeepRequired`?** — Same shape with `-?` and recursion.

## Common Mistakes
- Recursing into functions or arrays blindly.
- Not flattening intersections, leaving unreadable error messages.

## Tips
- Add the `Equals`/`Expect` tests as you code; it proves your types and shows testing discipline.
