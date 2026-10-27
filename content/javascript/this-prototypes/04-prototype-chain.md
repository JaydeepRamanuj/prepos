---
title: "Explain the prototype chain and prototypal inheritance"
level: medium
type: concept
tags: [prototype, prototype-chain, inheritance, __proto__, Object.create]
related: [javascript/new-keyword-implementation, javascript/classes-vs-prototypes, javascript/instanceof-object-create]
---

## Question
What is the prototype chain? What is the difference between `__proto__` and `prototype`, and how does property lookup and assignment work?

## Interview Answer
Every object has an internal link, `[[Prototype]]`, to another object or `null`. When I read a property that is not on the object itself, the engine follows that link and keeps going up the chain until it finds it or reaches `null` at the end, which is `Object.prototype`'s parent. That is prototypal inheritance: objects delegate to other objects. `__proto__` (or `Object.getPrototypeOf`) is the actual link on an instance, while `prototype` is a property on constructor functions that becomes the `[[Prototype]]` of objects created with `new`. Reads walk the chain, but writes go on the object itself and shadow anything higher up.

## Explanation
### Lookup

```js
const animal = { eats: true, speak() { return "..."; } };
const dog = Object.create(animal);   // dog.[[Prototype]] = animal
dog.barks = true;

dog.barks;   // own
dog.eats;    // found on animal
dog.toString // found on Object.prototype
dog.missing; // undefined (end of chain)
```

```txt
dog ──> animal ──> Object.prototype ──> null
```

### `__proto__` vs `prototype`

```js
function Person(name) { this.name = name; }
Person.prototype.hi = function () { return "hi " + this.name; };

const p = new Person("Asha");
Object.getPrototypeOf(p) === Person.prototype; // true
p.__proto__ === Person.prototype;              // true
Person.prototype.constructor === Person;       // true
```

- `Person.prototype`: the object to be used as prototype of instances.
- `p.__proto__`: the real link from instance. Prefer `Object.getPrototypeOf` and `Object.setPrototypeOf`; `__proto__` is legacy accessor.

### Writes and shadowing

```js
dog.eats = false;       // creates own property on dog; animal.eats untouched
delete dog.eats;        // now lookup falls back to animal.eats === true
```

Mutating a shared object property (like an array on the prototype) affects all instances, a classic bug.

### Checking
- `obj.hasOwn("x")` / `Object.hasOwn(obj, "x")`: own only.
- `"x" in obj`: own or inherited.
- `for...in` iterates inherited enumerable props; `Object.keys` only own.

### Why methods go on the prototype
One shared function instead of a copy per instance saves memory.

### Functions and arrays
`[]` → `Array.prototype` → `Object.prototype`. Functions inherit from `Function.prototype`.

## Follow-ups
- **What is at the end of the chain?** — `Object.prototype`, whose prototype is `null`; `Object.create(null)` makes a truly empty dictionary.
- **Is changing prototypes at runtime fine?** — Possible, but it deoptimizes engines; avoid `setPrototypeOf` in hot code.

## Common Mistakes
- Mixing up `prototype` and `__proto__`.
- Believing inherited properties are copied; they are looked up live.

## Tips
- Draw the chain with arrows; interviewers follow diagrams easily.
