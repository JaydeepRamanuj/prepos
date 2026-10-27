---
title: "The satisfies operator: how it differs from type annotations and assertions"
level: medium
type: concept
tags: [satisfies, type-annotations, type-assertions, inference, config-objects]
related: [typescript/const-assertions-and-literals, typescript/type-guards-predicates, typescript/mapped-types]
---

## Question
What does `satisfies` do, and how is it different from `: Type` annotations and `as Type` assertions? Give an example where `satisfies` gives you both validation and precise inference.

## Interview Answer
`expr satisfies T` checks that the expression is assignable to `T` without changing the expression's inferred type. A type annotation (`const x: T = …`) widens the variable to `T`, losing literal and specific property types; an assertion (`as T`) overrides the compiler and can lie. With `satisfies` you get validation (missing or extra keys, wrong value types are errors) and still keep the narrow inferred type, so autocomplete and exhaustive checks continue to work. It's ideal for configuration objects, route tables, theme tokens and lookup maps where you want to enforce a shape but keep keys and literal values. It can combine with `as const`: `{...} as const satisfies Config` for readonly literals that are validated.

## Explanation
### Three ways compared

```ts
type Colors = Record<string, string | [number, number, number]>;

// 1. Annotation: validated, but everything widens to the union
const a: Colors = { red: [255, 0, 0], green: "#0f0" };
a.red.map((c) => c);          // error: 'string | [number, number, number]' has no call signature like that
a.blue;                        // no error: any string key allowed (typo-prone)

// 2. Assertion: not really validated
const b = { red: [255, 0, 0], green: "#0f0", oops: 42 } as Colors;   // 42 sneaks through? (assertion only needs sufficient overlap)

// 3. satisfies: validated AND precise
const c = { red: [255, 0, 0], green: "#0f0" } satisfies Colors;
c.red.map((x) => x * 2);       // red is [number, number, number]
c.green.toUpperCase();         // green is string
// c.blue;                     // error: property 'blue' does not exist
// { …, oops: 42 } satisfies Colors  → error: number not assignable
```

### Keys checked exactly

```ts
type Theme = "light" | "dark";
const labels = {
  light: "Light",
  dark: "Dark",
  // darkk: "typo"      // satisfies Record<Theme, string> reports excess property here
} satisfies Record<Theme, string>;

labels.light;            // type: string (still gives per-key precision)
```

### With `as const`

```ts
const routes = {
  home: { path: "/", auth: false },
  dashboard: { path: "/dashboard", auth: true },
} as const satisfies Record<string, { path: `/${string}`; auth: boolean }>;

type RouteName = keyof typeof routes;             // "home" | "dashboard"
type DashboardPath = (typeof routes)["dashboard"]["path"];   // "/dashboard"
```

### Contextual typing
`satisfies` provides a contextual type, so callbacks inside the expression get parameter types:

```ts
type Handlers = Record<string, (e: MouseEvent) => void>;
const handlers = {
  click: (e) => console.log(e.clientX),     // e: MouseEvent (inferred from `satisfies`)
} satisfies Handlers;
```

### When to use which

| Tool | Use when |
|---|---|
| Annotation `: T` | you want the variable to *be* `T` (public API, mutable state) |
| `satisfies T` | validate a literal/config and keep its specific type |
| `as T` | last resort when you know more than the compiler (e.g. DOM queries); unchecked |
| `as const` | freeze literal types/readonly; combine with `satisfies` |

### Gotchas
- `satisfies` doesn't change the variable's declared type, so mutable properties aren't widened (`let` + object keeps `string`).
- For arrays, `[1, 2] satisfies number[]` gives `number[]`, add `as const` for tuples.
- Available since TypeScript 4.9; needs tooling (Babel/ESLint parsers, Prettier) updated.
- It checks excess properties on object literals only.

## Follow-ups
- **Can `satisfies` replace type assertions?** — For validation, yes; for overriding types, no.
- **How does this relate to Next.js `Metadata`?** — `export const metadata = { … } satisfies Metadata` keeps literal types while validating.

## Common Mistakes
- Using `as` to "fix" a mismatch that `satisfies` would have caught.
- Annotating config objects and losing literal key information.

## Tips
- Give the `Record<Theme, string>` example: completeness and no widening.
