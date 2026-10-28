---
title: "keyof, typeof and indexed access types: write a type-safe getProperty and groupBy"
level: hard
type: implement
tags: [keyof, indexed-access, typeof, generics, type-safe-helpers]
related: [typescript/generic-functions-constraints, typescript/mapped-types, javascript/map-filter-reduce]
---

## Question
Using `keyof`, `typeof` and indexed access types, implement:
1. `getProperty(obj, key)` whose return type matches the property type.
2. `groupBy(items, key)` that groups items by a property whose value is a string, returning `Record<string, T[]>`.
3. `setProperty(obj, key, value)` that only accepts a value matching the property type.

```ts
const user = { id: 1, name: "Asha", active: true };
getProperty(user, "name");          // string
getProperty(user, "nope");          // error
```

## Clues
- `keyof T` gives the union of property names.
- A second type parameter `K extends keyof T` links the key to the result.
- To restrict `groupBy` to keys with string values you need a mapped type that filters keys.

## Interview Answer
`keyof T` produces a union of an object's keys, and an indexed access type `T[K]` produces the type of the property at key `K`. By adding a second type parameter `K extends keyof T`, `getProperty<T, K extends keyof T>(obj: T, key: K): T[K]` ties the key to the return type, so `getProperty(user, "name")` is `string`, and unknown keys are compile errors. `setProperty` uses the same relationship for the value (`value: T[K]`). For `groupBy`, I filter keys whose value type is string with a mapped type, `{ [P in keyof T]: T[P] extends string ? P : never }[keyof T]`, and implement it with `reduce`. These patterns appear everywhere in typed utility libraries and ORMs.

## Explanation
### Building blocks

```ts
type User = { id: number; name: string; active: boolean };

type UserKeys = keyof User;                 // "id" | "name" | "active"
type NameType = User["name"];               // string
type IdOrName = User["id" | "name"];        // number | string
type AllValues = User[keyof User];          // number | string | boolean

const config = { retries: 3, url: "/api" };
type Config = typeof config;                // { retries: number; url: string }
```

### `getProperty` and `setProperty`

```ts
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

function setProperty<T, K extends keyof T>(obj: T, key: K, value: T[K]): void {
  obj[key] = value;
}

const user = { id: 1, name: "Asha", active: true };
const n = getProperty(user, "name");        // string
// getProperty(user, "nope");               // error: not assignable to "id" | "name" | "active"
setProperty(user, "active", false);         // OK
// setProperty(user, "id", "x");            // error: string not assignable to number
```

### Keys whose values are strings

```ts
type KeysOfType<T, V> = {
  [P in keyof T]-?: T[P] extends V ? P : never;
}[keyof T];

type S = KeysOfType<User, string>;          // "name"
```

### `groupBy`

```ts
function groupBy<T, K extends KeysOfType<T, string>>(items: readonly T[], key: K): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const group = item[key] as unknown as string;       // K guarantees string values; TS can't prove it through the mapped type
    (acc[group] ??= []).push(item);
    return acc;
  }, {});
}

const people = [
  { id: 1, role: "admin", name: "A" },
  { id: 2, role: "user", name: "B" },
  { id: 3, role: "user", name: "C" },
];
const byRole = groupBy(people, "role");     // Record<string, {…}[]>
// groupBy(people, "id");                   // error: "id" is not a string-valued key
```

The cast is a small, documented hole: TypeScript can't see that `T[K]` is `string` after going through `KeysOfType`. A common alternative avoids the cast by taking a selector function:

```ts
function groupByFn<T, K extends PropertyKey>(items: readonly T[], getKey: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) (out[getKey(item)] ??= []).push(item);
  return out;
}
const g = groupByFn(people, (p) => p.role);   // Record<string, …>
```

(Modern runtimes also provide `Object.groupBy`; TypeScript types it in `lib.es2024`.)

### Notes
- `keyof` on a type with an index signature includes `string | number`.
- `keyof any` is `string | number | symbol`.
- `T[K]` works with arrays: `string[][number]` is `string`; with tuples, `["a", 1][1]` is `number`.
- `typeof` in type position takes the static type of a value; it's different from the runtime operator.
- `as const` objects pair with `keyof typeof obj` to derive unions of keys.
- `noUncheckedIndexedAccess` makes index-signature reads `T | undefined`.

## Follow-ups
- **Why `K extends keyof T` rather than `string`?** — It restricts the key to real property names and lets TypeScript compute `T[K]`.
- **How do you get the value union of a const object?** — `(typeof obj)[keyof typeof obj]`.

## Common Mistakes
- Returning `any` instead of `T[K]`.
- Forgetting `-?` in the mapped type, which leaves `undefined` in the result for optional keys.

## Tips
- Sketch the `T`/`K`/`T[K]` triangle on the whiteboard first.
