---
title: "Built-in utility types: Partial, Required, Pick, Omit, Record, Exclude, Extract, ReturnType, Awaited"
level: medium
type: concept
tags: [utility-types, Partial, Pick, Omit, Record, ReturnType, Awaited]
related: [typescript/mapped-types, typescript/conditional-types-infer, typescript/typing-props-children-events]
---

## Question
List the most useful built-in utility types and show a realistic use for each. What are the pitfalls of `Omit` and of `Partial` for update payloads?

## Interview Answer
Utility types transform existing types so you don't duplicate them. `Partial<T>` makes all properties optional and `Required<T>` makes them required; `Readonly<T>` freezes them at the type level; `Pick<T, K>` and `Omit<T, K>` select or drop keys; `Record<K, V>` builds an object type from a key union; `Exclude<U, X>` and `Extract<U, X>` filter union members; `NonNullable<T>` removes `null`/`undefined`; `ReturnType<F>` and `Parameters<F>` extract function types; `Awaited<T>` unwraps promises; and `InstanceType` does so for constructors. Pitfalls: `Omit` isn't distributive, so on a union it collapses to common keys, and it doesn't check that the keys exist (the key parameter is `keyof any`); `Partial` for updates allows an empty object and accepts `undefined` values, so I often combine it with `Pick`/`Required` for exact contracts.

## Explanation
### Cheat sheet

```ts
interface User { id: string; name: string; email: string | null; role: "admin" | "user" }

type Draft = Partial<User>;                        // all optional
type Strict = Required<User>;                      // all required, removes `?` (null remains)
type ReadonlyUser = Readonly<User>;
type PublicUser = Pick<User, "id" | "name">;
type NewUser = Omit<User, "id">;                   // form payload without the server-generated id
type RolePerms = Record<User["role"], string[]>;   // { admin: string[]; user: string[] }

type Events = "click" | "scroll" | "keydown";
type NoKeys = Exclude<Events, "keydown">;          // "click" | "scroll"
type OnlyClick = Extract<Events, "click" | "tap">; // "click"
type Email = NonNullable<User["email"]>;           // string

function createUser(name: string) { return { id: crypto.randomUUID(), name }; }
type Created = ReturnType<typeof createUser>;      // { id: string; name: string }
type Args = Parameters<typeof createUser>;         // [name: string]

async function load() { return [1, 2, 3]; }
type Loaded = Awaited<ReturnType<typeof load>>;    // number[]
```

### Realistic uses
- **Update endpoints**: `type UpdateUser = Partial<Omit<User, "id">>`.
- **Form state**: `Record<keyof NewUser, string>` for error messages per field.
- **Lookup tables**: `Record<Status, Config>` makes the compiler enforce every status has an entry.
- **Component props wrappers**: `Omit<ComponentProps<"button">, "onChange">`.
- **Typing HOFs**: `(...args: Parameters<F>) => ReturnType<F>`.

### Pitfalls

```ts
// Omit is not distributive over unions
type A = { kind: "a"; a: number; common: string };
type B = { kind: "b"; b: number; common: string };
type Bad = Omit<A | B, "common">;                   // { kind: "a" | "b" } only: lost a and b!

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Good = DistributiveOmit<A | B, "common">;      // { kind: "a"; a: number } | { kind: "b"; b: number }

// Omit accepts keys that don't exist: typos are silent
type Typo = Omit<User, "idd">;                      // no error; use Exclude<keyof User, "idd"> pattern or a strict Omit

type StrictOmit<T, K extends keyof T> = Omit<T, K>; // catches typos
```

```ts
// Partial permits {} and explicit undefined
const patch: Partial<User> = {};                    // valid, probably a no-op
const patch2: Partial<User> = { name: undefined };  // allowed (unless exactOptionalPropertyTypes)
```

Enable `exactOptionalPropertyTypes` to distinguish "missing" from `undefined`, and validate that at least one field is present at runtime.

### Tips
- Compose: `Readonly<Partial<Pick<…>>>` reads right to left.
- Hover over aliases (or use `type X = Expand<…>` helper) to display resolved shapes:

```ts
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
```

- Know that most are implemented with mapped and conditional types (see those questions); you can write your own.

## Follow-ups
- **`Record<string, T>` vs index signature?** — Equivalent; `Record<K, V>` also works with unions of literal keys for exhaustive objects.
- **`Pick` vs `Omit` when types change?** — `Pick` is explicit and stable; `Omit` auto-includes newly added keys.

## Common Mistakes
- Using `Omit` on discriminated unions.
- Believing `Readonly` freezes at runtime.

## Tips
- Mention `Awaited<ReturnType<typeof fn>>`; it's constantly used with async functions.
