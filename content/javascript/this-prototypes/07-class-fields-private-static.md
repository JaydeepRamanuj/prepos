---
title: "How do class fields, private members and static members work?"
level: hard
type: concept
tags: [classes, private-fields, static, class-fields, encapsulation]
related: [javascript/classes-vs-prototypes, javascript/class-inheritance-super, javascript/closure]
---

## Question
Explain public and private class fields, `static` members and static blocks. How is `#private` different from a `_underscore` convention or closures, and what are its gotchas?

## Clues
- Private names are enforced by the language, not by naming.
- Fields are initialised per instance, at a specific time relative to `super()`.
- A private field cannot be read through a Proxy or a different object that lacks the brand.

## Interview Answer
Class fields declare per-instance properties directly in the class body, initialised when the object is constructed — before the constructor body in a base class and right after `super()` returns in a derived class. `#name` makes a member truly private: only code lexically inside the class body can access it, accessing it elsewhere is a syntax error, and it is not visible through `Object.keys`, `JSON.stringify` or reflection. `static` members belong to the constructor, not instances, and `static {}` blocks run once for complex static initialisation. Compared with `_name`, private fields are enforced; compared with closures, they are cheaper to write and can be shared between instances of the same class, like in `equals(other)`.

## Explanation
### Syntax

```js
class Counter {
  static instances = 0;          // static field
  #count = 0;                    // private field
  step = 1;                      // public field

  static { Counter.instances = 0; }  // static initialisation block

  constructor() { Counter.instances++; }

  #log() { console.log(this.#count); }   // private method
  inc() { this.#count += this.step; this.#log(); }

  get value() { return this.#count; }

  static isCounter(o) { return #count in o; }  // brand check (ES2022)
}
```

### Privacy guarantees
- `counter.#count` outside the class is a SyntaxError, not `undefined`.
- Not copied by spread, not in `JSON.stringify`.
- Subclasses cannot access a parent's `#x`.
- Instances of the same class can access each other's private fields: `other.#count`.

### Gotchas
- Accessing `#x` on an object that doesn't have it throws a TypeError, so use `#x in obj` to check.
- Proxy wrapping an instance breaks private access because `this` is the proxy: `proxy.method()` calling `this.#x` throws.
- Arrow-function fields create a function per instance.
- Field initialisers run in order; a field cannot rely on a later one.
- `this` in static methods is the class (or subclass) on which it was called.

### Static inheritance

```js
class A { static create() { return new this(); } }
class B extends A {}
B.create() instanceof B;   // true
```

### Choosing

| Need | Option |
|---|---|
| Hide implementation | `#private` |
| Soft "don't touch" | `_name` convention |
| Per-instance privacy without classes | closure |
| Shared constants | `static` |

TypeScript's `private` keyword is only compile-time; `#` is runtime-enforced.

## Follow-ups
- **Can you create a private field dynamically?** — No; they are declared statically in the class body.
- **How can tests access privates?** — Test via the public API, or expose a controlled seam; don't rely on reflection.

## Common Mistakes
- Thinking `_name` is private.
- Wrapping instances in Proxies and being surprised by TypeErrors on private access.

## Tips
- Mention TypeScript `private` vs `#private` to show you know the compile-time/runtime distinction.
