---
title: "type vs interface: what's the difference and which should you use?"
level: easy
type: concept
tags: [types, interfaces, declaration-merging, extends, intersection]
related: [typescript/union-narrowing-discriminated, typescript/mapped-types, typescript/typing-props-children-events]
---

## Question
What are the practical differences between `type` aliases and `interface` declarations in TypeScript? When do you choose each?

## Interview Answer
For describing object shapes they are almost interchangeable, and both support optional and readonly properties, methods and extension. The key differences: an `interface` can be reopened and merged (declaration merging) and extends other interfaces with `extends`, with clearer error messages and slightly better performance on large hierarchies; a `type` alias can name anything, not only objects, including unions, intersections, tuples, primitives, mapped and conditional types, but cannot be merged. My rule of thumb: use `interface` for public object contracts and class shapes that others may extend or augment, and `type` for unions, utility compositions and anything that isn't a plain object; above all, be consistent within a codebase, since the choice rarely matters for correctness.

## Explanation
### Same job

```ts
interface User {
  id: string;
  name: string;
  email?: string;
  readonly createdAt: Date;
}

type UserT = {
  id: string;
  name: string;
  email?: string;
  readonly createdAt: Date;
};
```

### Extending

```ts
interface Admin extends User { permissions: string[] }
type AdminT = UserT & { permissions: string[] };       // intersection
```

`interface extends` reports conflicting member types as an error at the declaration; intersections silently produce `never` for conflicts, which surfaces later.

### Things only `type` can do

```ts
type ID = string | number;                              // union
type Point = [number, number];                          // tuple
type Fn = (a: number) => string;                        // function type (interfaces can use call signatures)
type Keys = keyof User;                                 // derived
type Optional<T> = { [K in keyof T]?: T[K] };           // mapped
type IsString<T> = T extends string ? true : false;     // conditional
```

### Things only `interface` can do

```ts
interface Window { analytics: Analytics }               // declaration merging / module augmentation
interface Window { appVersion: string }                 // merges with the previous declaration
```

Merging is how libraries are augmented (`declare module "express"` adding fields) and how `lib.dom.d.ts` is extended.

### Comparison

| | `interface` | `type` |
|---|---|---|
| Object shapes | yes | yes |
| Unions, primitives, tuples | no | yes |
| Declaration merging | yes | no |
| Extension | `extends` | `&` |
| Implemented by classes | yes | yes (if object-like) |
| Mapped/conditional types | no | yes |
| Error messages / caching | usually better | fine |

### Choosing
- Public API of a library or shared domain model: `interface` (open for augmentation).
- Props in React components: either; many teams use `type` for props, `interface` for contracts.
- Everything else (unions, function types, derived types): `type`.
- Do not mix both for the same concept without a reason.

## Follow-ups
- **Can a class implement a type alias?** — Yes if it's an object type; unions can't be implemented.
- **Why do big projects like `interface`?** — Interfaces create named types that the compiler caches, which helps performance in deep extension chains.

## Common Mistakes
- Claiming interfaces are for objects and types are for primitives only.
- Using intersections to "extend" with conflicting properties and getting `never`.

## Tips
- Mention declaration merging and unions; those are the real differences.
