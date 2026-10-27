---
title: "What are Symbols, and what are well-known symbols used for?"
level: hard
type: concept
tags: [symbol, well-known-symbols, Symbol.iterator, Symbol.toPrimitive, metaprogramming]
related: [javascript/iterators-generators, javascript/proxy-reflect, javascript/coercion-comparison-output]
---

## Question
What problem do `Symbol`s solve? How does `Symbol.for` differ from `Symbol()`, and which well-known symbols (`iterator`, `toPrimitive`, `hasInstance`, `toStringTag`) let objects customise language behaviour?

## Clues
- Symbols are unique, primitive values often used as property keys.
- Some symbols are hooks the language calls on your objects.
- Symbol keys do not appear in `for...in`, `Object.keys` or `JSON.stringify`.

## Interview Answer
A `Symbol` is a unique primitive: every `Symbol("desc")` is distinct even with the same description, which makes it a collision-free property key, handy for hidden metadata and for extending objects you do not own. Symbol-keyed properties are skipped by `Object.keys`, `for...in` and `JSON.stringify`, though `Object.getOwnPropertySymbols` can find them. `Symbol.for("key")` looks up a shared global registry so the same key returns the same symbol across modules or realms. Well-known symbols are protocol hooks: `Symbol.iterator` makes an object iterable, `Symbol.toPrimitive` customises coercion, `Symbol.hasInstance` customises `instanceof`, and `Symbol.toStringTag` changes `Object.prototype.toString` output.

## Explanation
### Uniqueness and use as keys

```js
const id1 = Symbol("id");
const id2 = Symbol("id");
id1 === id2;                 // false

const user = { name: "Asha", [id1]: 123 };
Object.keys(user);           // ["name"]
JSON.stringify(user);        // {"name":"Asha"}
user[id1];                   // 123
Object.getOwnPropertySymbols(user); // [Symbol(id)]
```

Not truly private (reflection finds them); use `#private` for real privacy.

### Registry

```js
Symbol.for("app.key") === Symbol.for("app.key");   // true
Symbol.keyFor(Symbol.for("app.key"));              // "app.key"
```

### Well-known symbols

```js
// iterable
const col = { *[Symbol.iterator]() { yield 1; yield 2; } };
[...col];   // [1, 2]

// coercion
const money = {
  amount: 5,
  [Symbol.toPrimitive](hint) {          // "number" | "string" | "default"
    return hint === "string" ? `$${this.amount}` : this.amount;
  },
};
+money;            // 5
`${money}`;        // "$5"
money + 1;         // 6   (hint "default")

// instanceof
class Even { static [Symbol.hasInstance](n) { return n % 2 === 0; } }
4 instanceof Even; // true

// toString tag
class Thing { get [Symbol.toStringTag]() { return "Thing"; } }
String(new Thing());   // "[object Thing]"
```

Other hooks: `Symbol.asyncIterator`, `Symbol.species`, `Symbol.isConcatSpreadable`, `Symbol.match`.

### Practical uses
- Library-internal keys that cannot clash with user keys (React tags its elements with a `Symbol.for(...)` marker; branded-type markers).
- Enum-like constants: `const LEVEL = { LOW: Symbol("low") }`.
- Making custom classes work with language syntax.

### Gotchas
- `Symbol()` cannot be implicitly converted to a string: `"x" + sym` throws; use `sym.toString()` or `sym.description`.
- Not serialisable; do not use symbol keys for data that must be saved.
- Cannot be used with `new`.

## Follow-ups
- **Are Symbols objects?** — No, primitives; `typeof` is `"symbol"`.
- **Why isn't `Symbol.iterator` a string like `"@@iterator"`?** — A symbol avoids collisions with user property names.

## Common Mistakes
- Treating symbol keys as private.
- Using `Symbol()` where cross-module sharing is needed instead of `Symbol.for`.

## Tips
- Know `Symbol.iterator` and `Symbol.toPrimitive` examples by heart; they cover most questions.
