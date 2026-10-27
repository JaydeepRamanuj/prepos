---
title: "Template literal types: typed event names, routes and string parsing"
level: hard
type: concept
tags: [template-literal-types, string-manipulation, infer, routes, event-names]
related: [typescript/mapped-types, typescript/conditional-types-infer, typescript/const-assertions-and-literals]
---

## Question
What are template literal types? Show how to combine unions into string unions, use `Capitalize`/`Uppercase`, parse strings with `infer`, and build a type that extracts route params from a path like `"/users/:id/posts/:postId"`.

## Clues
- Template literal types look like JS template strings but live in the type space.
- Unions inside a template produce a union of all combinations.
- `infer` can capture pieces of a string.

## Interview Answer
Template literal types build string literal types from other types, like `` `on${Capitalize<Event>}` ``. When a placeholder is a union, TypeScript expands every combination, so `` `${Entity}:${Action}` `` becomes a union of all event names, which gives autocompletion and compile-time checks for string-based APIs. With conditional types and `infer`, they can pattern-match strings: ``T extends `${infer Head}/${infer Rest}` `` splits on the first slash. This enables typed route params extraction, typed CSS values, mapped types that rename keys, and typed event emitters. Intrinsic helpers `Uppercase`, `Lowercase`, `Capitalize` and `Uncapitalize` transform casing. The cost is complexity and compile time if you push it too far, so I use it where it prevents real bugs, such as event names, route patterns and config keys.

## Explanation
### Building unions

```ts
type Entity = "user" | "post";
type Action = "created" | "deleted";
type EventName = `${Entity}:${Action}`;
// "user:created" | "user:deleted" | "post:created" | "post:deleted"

type Handler = `on${Capitalize<Action>}`;         // "onCreated" | "onDeleted"

function emit(event: EventName, payload: unknown) {}
emit("user:created", {});
// emit("user:updated", {});                       // error
```

Numbers and other primitives work too: `` type Px = `${number}px` `` accepts `"12px"`, `"1.5px"`.

### Combining with mapped types

```ts
type Events = { click: MouseEvent; focus: FocusEvent };
type Listeners = {
  [K in keyof Events as `on${Capitalize<K & string>}`]?: (e: Events[K]) => void;
};
// { onClick?: (e: MouseEvent) => void; onFocus?: (e: FocusEvent) => void }
```

### Parsing strings with `infer`

```ts
type Trim<S extends string> = S extends ` ${infer R}` | `${infer R} ` ? Trim<R> : S;
type T = Trim<"  hello ">;                        // "hello"

type Split<S extends string, D extends string> =
  S extends `${infer Head}${D}${infer Tail}` ? [Head, ...Split<Tail, D>] : [S];
type Parts = Split<"a/b/c", "/">;                 // ["a", "b", "c"]
```

### Route params

```ts
type ExtractParams<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<`/${Rest}`>
    : Path extends `${string}:${infer Param}`
    ? Param
    : never;

type P = ExtractParams<"/users/:id/posts/:postId">;       // "id" | "postId"

type RouteParams<Path extends string> = { [K in ExtractParams<Path>]: string };

function buildPath<P extends string>(path: P, params: RouteParams<P>): string {
  return path.replace(/:([A-Za-z]+)/g, (_, key: string) => (params as Record<string, string>)[key]);
}

buildPath("/users/:id/posts/:postId", { id: "1", postId: "9" });
// buildPath("/users/:id", { name: "x" });               // error: missing id / unknown name
```

### Typed dotted paths

```ts
type Paths<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object ? K | `${K}.${Paths<T[K]>}` : K }[keyof T & string]
  : never;

type Config = { db: { host: string; port: number }; debug: boolean };
type ConfigPath = Paths<Config>;                  // "db" | "db.host" | "db.port" | "debug"
```

### Real-world uses
- Typed i18n keys, CSS custom properties, Tailwind-like class helpers.
- Next.js `typedRoutes` generates `Route` string unions for `<Link href>`.
- Typed `localStorage` keys or analytics event names.
- Library APIs like TanStack Router's path strings.

### Limits
- Recursion depth and union size explosion (cartesian products grow fast; 100k+ members error).
- Slower type-checking and cryptic errors; keep helpers small and tested with type-level assertions.
- Cannot do arbitrary parsing (regex-like) easily.

## Follow-ups
- **Why `K & string`?** — Keys can be `string | number | symbol`; template literals accept only string-like types.
- **How do you test types?** — Assertions with `expectTypeOf` (Vitest) or `tsd`/`type-fest` helpers.

## Common Mistakes
- Forgetting that unions multiply.
- Using these types where a plain `string` is enough.

## Tips
- Use the event-name and route-params examples; they're memorable.
