---
title: "Mapped types: modifiers, key remapping and building your own utilities"
level: hard
type: concept
tags: [mapped-types, key-remapping, modifiers, readonly, optional]
related: [typescript/utility-types, typescript/template-literal-types, typescript/keyof-indexed-access]
---

## Question
How do mapped types work? Explain `+`/`-` modifiers, key remapping with `as`, and write `Getters<T>` (turns `{ name: string }` into `{ getName: () => string }`) and `Mutable<T>`.

## Clues
- The syntax iterates over a union of keys: `{ [K in Keys]: … }`.
- `-readonly` and `-?` remove modifiers.
- `as` in the key position can rename or filter keys.

## Interview Answer
A mapped type creates an object type by iterating over a union of keys: `{ [K in keyof T]: Transform<T[K]> }`. When the iterated union is `keyof T` it is homomorphic, so it preserves the original optional and readonly modifiers; you can add or remove them with `+readonly`, `-readonly`, `+?`, `-?`. Since TypeScript 4.1 you can remap keys with `as`, using template literal types to rename or `never` to filter. That's how `Partial`, `Required`, `Readonly`, `Pick` and `Record` are defined, and how I'd build `Getters<T>`: iterate over `keyof T` with ``as `get${Capitalize<string & K>}` `` and map each value to a function returning `T[K]`. `Mutable<T>` removes readonly with `-readonly`. Mapped types are the foundation for most type-level utilities.

## Explanation
### The built-ins

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyRequired<T> = { [K in keyof T]-?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type MyRecord<K extends PropertyKey, V> = { [P in K]: V };
```

### Removing readonly

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type Frozen = { readonly id: string; readonly tags: readonly string[] };
type Thawed = Mutable<Frozen>;      // { id: string; tags: readonly string[] } (shallow!)
```

### Key remapping

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Person = { name: string; age: number };
type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }
```

`string & K` narrows keys to strings (keys may also be numbers or symbols).

### Filtering with `as never`

```ts
type OmitByType<T, V> = {
  [K in keyof T as T[K] extends V ? never : K]: T[K];
};

type NoFunctions = OmitByType<{ a: number; f(): void }, Function>;   // { a: number }

type PickByType<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};
```

### Mapping over unions and tuples

```ts
type EventMap<E extends string> = { [K in E]: (payload: unknown) => void };
type Handlers = EventMap<"open" | "close">;        // { open: …; close: … }

type Boxed<T> = { [K in keyof T]: { value: T[K] } };
type BoxedTuple = Boxed<[string, number]>;         // [{ value: string }, { value: number }] (homomorphic mapped types preserve tuples)
```

### Deep versions need recursion

```ts
type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
```

(Functions are objects too; refine with `T extends Function ? T : …` when needed.)

### Practical uses
- Form state from a model: `type FormErrors<T> = { [K in keyof T]?: string }`.
- Event handler maps: `{ [K in keyof Events as `on${Capitalize<K & string>}`]?: (e: Events[K]) => void }`.
- API response transforms: convert snake_case keys to camelCase types with template literals.
- Wrapping every method of a service to return promises.

### Gotchas
- Homomorphic (`keyof T`) mapped types preserve modifiers; mapping over a plain union doesn't.
- `as` clauses make the mapped type non-homomorphic in older versions; modifiers behaviour is still preserved when the source is `keyof T`.
- Index signatures and optional properties interact (`-?` removes `undefined` that came from `?`, but not explicit `| undefined` types unless `exactOptionalPropertyTypes` off).
- Display with `Expand`-style helpers if hovers are unreadable.

## Follow-ups
- **Difference between `Record<string, T>` and a mapped type over `string`?** — Same result: an index signature.
- **How is `Readonly<T>` different at runtime?** — No runtime effect.

## Common Mistakes
- Forgetting `string &` when using template literals with `keyof T`.
- Expecting `Mutable` to be deep.

## Tips
- Write `Getters<T>` live; it exercises remapping, template literals and indexed access.
