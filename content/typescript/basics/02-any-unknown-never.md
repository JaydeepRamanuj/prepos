---
title: "any vs unknown vs never: what are they and when do you use each?"
level: medium
type: concept
tags: [any, unknown, never, type-safety, exhaustiveness]
related: [typescript/type-guards-predicates, typescript/union-narrowing-discriminated, typescript/const-assertions-and-literals]
---

## Question
Explain `any`, `unknown` and `never`. Why is `unknown` safer than `any`, and what is `never` used for in practice, for example in exhaustive checks?

## Interview Answer
`any` turns off type checking: you can do anything with it and it spreads silently through your code. `unknown` is the type-safe top type: any value can be assigned to it, but you must narrow it (with `typeof`, `instanceof`, type guards or a validator like Zod) before using it, so it's the right type for untrusted input such as `JSON.parse`, `catch` variables and API responses. `never` is the bottom type with no values: it's the return type of functions that never return (throw or loop forever), the result of impossible narrowing, and the tool for exhaustiveness checks, where assigning the leftover value to `never` makes the compiler complain if a new union member isn't handled. I avoid `any`, use `unknown` at boundaries, and use `never` to make switch statements future-proof.

## Explanation
### `any` vs `unknown`

```ts
let a: any = "hello";
a.toFixed();            // compiles, crashes at runtime
const n: number = a;    // allowed, unsound

let u: unknown = "hello";
u.toUpperCase();        // error: 'u' is of type 'unknown'
if (typeof u === "string") u.toUpperCase();   // OK after narrowing
const m: number = u;    // error
```

| | `any` | `unknown` |
|---|---|---|
| Assign anything to it | yes | yes |
| Assign it to other types | yes (unsound) | only `unknown`/`any` |
| Property access / call | allowed | error until narrowed |
| Infectiousness | spreads through inference | contained |

### Where `unknown` belongs

```ts
async function load(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();                    // Response.json() returns Promise<any> in lib.dom; wrapping as unknown forces checks
}

try {
  risky();
} catch (e) {                           // with useUnknownInCatchVariables (part of strict), e is unknown
  if (e instanceof Error) console.error(e.message);
}
```

Combine with a runtime validator (Zod, Valibot) to turn `unknown` into a typed value.

### `never`

```ts
function fail(message: string): never {
  throw new Error(message);
}

type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.r ** 2;
    case "square": return s.s ** 2;
    default: {
      const _exhaustive: never = s;      // error if a new Shape kind is added and not handled
      return _exhaustive;
    }
  }
}
```

Other appearances: `string & number` is `never`; an empty union; filtering out members in conditional types (`Exclude<T, U>` yields `never` for removed members, which vanishes from unions).

### When `any` is acceptable
- Migrating JavaScript gradually (`// @ts-expect-error` or targeted `any`).
- Truly dynamic code where typing costs more than it gains, localised and commented.
- Prefer `unknown`, generics or overloads even then. The ESLint rule `no-explicit-any` helps.

### Related compiler flags
`strict` enables `noImplicitAny`, `useUnknownInCatchVariables`, `strictNullChecks`. Turn on `noUncheckedIndexedAccess` for safer array/record reads.

## Follow-ups
- **What is the top type vs bottom type?** — `unknown` is top (everything assignable to it); `never` is bottom (assignable to everything, nothing assignable to it).
- **`void` vs `never`?** — `void` is a function that returns nothing normally; `never` never returns.

## Common Mistakes
- Using `any` to silence an error.
- Treating `unknown` as "any but annoying".
- Forgetting the `default: never` check.

## Tips
- Show the exhaustiveness example; it demonstrates real value of `never`.
