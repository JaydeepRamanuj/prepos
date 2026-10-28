---
title: "Write custom type guards, assertion functions and a safe JSON parser"
level: hard
type: implement
tags: [type-guards, type-predicates, assertion-functions, unknown, validation]
related: [typescript/any-unknown-never, typescript/union-narrowing-discriminated, state/zod-server-validation]
---

## Question
Implement `isString(x: unknown): x is string`, a guard for an object type `User`, and an assertion function `assertIsUser(x): asserts x is User`. Then use them to safely handle `JSON.parse` output. Explain the unsoundness risk of type predicates.

```ts
type User = { id: number; name: string; email?: string };
```

## Clues
- A type predicate return type `x is T` tells the compiler what a `true` result means.
- Assertion functions throw instead of returning a boolean.
- The compiler trusts your predicate; nothing checks that it is correct.

## Interview Answer
A type guard is a function whose return type is a predicate like `x is User`. When it returns true, TypeScript narrows the argument in the calling scope. For an `unknown` input, the guard must really verify the shape at runtime: check it is a non-null object and test each property's type. An assertion function has the signature `asserts x is User` and throws if the check fails, which narrows for the rest of the scope without an `if`. The danger is that the compiler doesn't verify the body, so a wrong or incomplete guard produces false type safety; that's why for larger schemas I use a validator such as Zod, which derives both the type and the check from one definition and removes the possibility of drift.

## Explanation
### Guards

```ts
type User = { id: number; name: string; email?: string };

const isString = (x: unknown): x is string => typeof x === "string";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isUser(x: unknown): x is User {
  return (
    isObject(x) &&
    typeof x.id === "number" &&
    typeof x.name === "string" &&
    (x.email === undefined || typeof x.email === "string")
  );
}
```

### Assertion function

```ts
function assertIsUser(x: unknown): asserts x is User {
  if (!isUser(x)) throw new TypeError("Invalid user payload");
}
```

### Using them

```ts
const raw: unknown = JSON.parse(text);

if (isUser(raw)) {
  raw.name.toUpperCase();          // raw: User here
}

assertIsUser(raw);
raw.id.toFixed();                  // raw: User for the rest of the scope
```

### Narrowing arrays

```ts
const values: (string | null)[] = ["a", null, "b"];
const strings = values.filter((v): v is string => v !== null);   // string[]
```

TypeScript 5.5 can infer simple type predicates from `filter(v => v !== null)`, but explicit predicates stay clearer for anything non-trivial.

### Unsoundness

```ts
function isUserBad(x: unknown): x is User {
  return typeof x === "object";    // compiles, but says every object is a User
}
```

The compiler cannot detect this. Guards are as correct as their bodies.

### Use a schema when shapes grow

```ts
import { z } from "zod";
const UserSchema = z.object({ id: z.number(), name: z.string(), email: z.string().optional() });
type User = z.infer<typeof UserSchema>;       // type derived from the schema
const user = UserSchema.parse(JSON.parse(text));   // throws on mismatch; safeParse returns a result
```

### Guards vs assertions vs casts

| | Behaviour | Safety |
|---|---|---|
| `x is T` predicate | boolean result, narrows in branches | as good as the check |
| `asserts x is T` | throws on failure, narrows after the call | as good as the check |
| `x as T` | no runtime check | none: avoid at trust boundaries |

### Edge cases
- Arrays, nested objects and numeric ranges need recursive checks.
- `NaN` is `typeof "number"`; use `Number.isFinite` if needed.
- Assertion functions must be declared with an explicit type annotation (function declarations or typed consts) to be recognised.
- Guards for classes can simply use `instanceof`.

## Follow-ups
- **What does `asserts x` (without `is`) do?** — It asserts truthiness, narrowing like `if (!x) throw`.
- **Why is `as` dangerous?** — It overrides the compiler without verifying anything.

## Common Mistakes
- Writing a guard that returns true too eagerly.
- Using `as User` on JSON and calling it validated.

## Tips
- Say "predicates are promises to the compiler" and recommend schema validation for real payloads.
