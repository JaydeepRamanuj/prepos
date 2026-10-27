---
title: "Generic pitfalls: widening, variance, and why this call doesn't type-check"
level: advanced
type: debugging
tags: [generics, variance, inference, assignability, covariance, contravariance]
related: [typescript/generic-defaults-inference, typescript/generic-functions-constraints, typescript/union-narrowing-discriminated]
---

## Question
Explain why each snippet fails or behaves unexpectedly, and fix it.

```ts
// 1
function pair<T>(a: T, b: T): [T, T] { return [a, b]; }
const p = pair("a", 1);

// 2
const items: Array<string | number> = ["a", 1];
const strings: Array<string> = ["x"];
const mixed: Array<string | number> = strings;      // allowed?
function addNumber(list: Array<string | number>) { list.push(1); }
addNumber(strings);

// 3
type Handler<T> = (value: T) => void;
const onString: Handler<string> = (v) => v.toUpperCase();
const onAny: Handler<string | number> = onString;

// 4
function setDefault<T>(value: T | undefined, fallback: T): T {
  return value ?? fallback;
}
const d = setDefault(undefined, 5);
```

## Clues
- Think about which direction assignability goes for return positions versus parameter positions.
- Arrays are treated as covariant in TypeScript even though they are mutable.
- `strictFunctionTypes` applies to function-type properties, not method syntax.

## Interview Answer
(1) With two arguments of different types, TypeScript infers `T` from both candidates and reports an error because `"a"` and `1` have no single best common type; fix by widening explicitly (`pair<string | number>`) or by using two type parameters. (2) `Array<string>` is assignable to `Array<string | number>` because arrays are covariant, which is unsound: `addNumber(strings)` compiles but pushes a number into a string array; use `readonly` arrays when you only read, and avoid mutating through a wider type. (3) Function parameters are contravariant under `strictFunctionTypes`: a handler that accepts only `string` cannot stand in for one that must accept `string | number`, so the assignment is an error. (4) `setDefault(undefined, 5)` infers `T` as `number` and works; the surprising part is that candidates from both positions combine, which is why `setDefault<string>(undefined, 5)` fails with an explicit argument. Understanding variance explains most assignability errors with generics.

## Explanation
### 1. Competing candidates

```ts
const p = pair("a", 1);                 // error: Argument of type 'number' is not assignable to parameter of type 'string'
const p1 = pair<string | number>("a", 1);  // OK

function pair2<A, B>(a: A, b: B): [A, B] { return [a, b]; }
```

The first inference candidate (`string`) wins for non-union situations; the second argument then fails. Use separate parameters if types may differ.

### 2. Covariance of arrays (unsound)

```ts
const strings: string[] = ["x"];
const mixed: (string | number)[] = strings;   // allowed
mixed.push(1);                                // compiles; strings now contains a number at runtime
```

Safer: `readonly (string | number)[]` for parameters that only read:

```ts
function printAll(list: readonly (string | number)[]) { list.forEach(console.log); }
printAll(strings);       // OK and sound because no writes are possible
```

### 3. Contravariance of parameters

```ts
type Handler<T> = (value: T) => void;
const onString: Handler<string> = (v) => v.toUpperCase();
const onAny: Handler<string | number> = onString;     // error under strictFunctionTypes

// The opposite direction is fine:
const onUnion: Handler<string | number> = (v) => console.log(v);
const onStr: Handler<string> = onUnion;               // OK: handler accepting more can be used where less is given
```

Rule: **producers (returns) are covariant, consumers (parameters) are contravariant.** Method shorthand (`{ handle(v: T): void }`) is checked bivariantly for historical reasons, which is why `strictFunctionTypes` doesn't flag it.

### Variance annotations (TS 4.7+)

```ts
interface Producer<out T> { get(): T }          // covariant
interface Consumer<in T> { accept(v: T): void } // contravariant
interface Box<in out T> { get(): T; set(v: T): void }   // invariant
```

They document intent and speed up checking; the compiler errors if usage contradicts the annotation.

### 4. Inference with a fallback

```ts
function setDefault<T>(value: T | undefined, fallback: T): T { return value ?? fallback; }
setDefault(undefined, 5);            // T = number
setDefault<string>(undefined, 5);    // error: 5 is not assignable to string
setDefault("a", 5);                  // error: candidates string and number conflict
```

To let `fallback` be checked against `T` without influencing it, use `NoInfer`:

```ts
function setDefault2<T>(value: T | undefined, fallback: NoInfer<T>): T { return value ?? fallback; }
setDefault2("a", 5);                 // error as intended: 5 is not a string
```

### Debugging approach
1. Hover to see inferred type arguments.
2. Make candidates explicit with `<T>` to see which argument is rejected.
3. Ask: is this position a producer or a consumer?
4. Consider `readonly`, `NoInfer`, overloads, or separate type parameters.
5. Avoid `as` casts to silence variance errors; they mask real unsoundness.

## Follow-ups
- **Are `Promise<T>` and `Set<T>` covariant?** — `Promise<T>` is covariant; `Set<T>` is treated covariantly in practice but is mutable (unsound), `ReadonlySet<T>` is sound.
- **Why does React's `Dispatch<SetStateAction<T>>` matter?** — It's contravariant in `T`, so `Dispatch<SetStateAction<string>>` can't be assigned to a `Dispatch<SetStateAction<string | null>>` prop.

## Common Mistakes
- Fixing with `as any`.
- Assuming TypeScript's array covariance is sound.

## Tips
- Say "producers covariant, consumers contravariant" and give the `Handler` example.
