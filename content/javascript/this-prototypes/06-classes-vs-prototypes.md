---
title: "Are ES6 classes real classes? How do they relate to prototypes?"
level: medium
type: concept
tags: [classes, prototype, syntactic-sugar, constructor, methods]
related: [javascript/prototype-chain, javascript/class-fields-private-static, javascript/class-inheritance-super]
---

## Question
Is `class` just syntactic sugar over prototypes? What differences does it have from constructor functions, and where do methods end up?

## Interview Answer
Classes are mostly syntax over the same prototype mechanism: methods defined in a class body live on `Class.prototype`, shared by instances, and `typeof Class` is still `"function"`. But they are not purely sugar, because they add stricter behaviour: the class body is always in strict mode, calling a class without `new` throws, methods are non-enumerable, class declarations have a temporal dead zone, and inheritance uses `extends`/`super` with correct handling of built-ins. Fields and private `#` members are new capabilities that constructor functions cannot replicate exactly. So I say "same inheritance model, safer and more expressive syntax".

## Explanation
### Equivalent forms

```js
class Person {
  constructor(name) { this.name = name; }
  hi() { return "hi " + this.name; }
  static create(n) { return new Person(n); }
}

// roughly:
function PersonFn(name) { this.name = name; }
PersonFn.prototype.hi = function () { return "hi " + this.name; };
PersonFn.create = (n) => new PersonFn(n);
```

```js
typeof Person;                                 // "function"
Object.getPrototypeOf(new Person("a")) === Person.prototype; // true
Person.prototype.hasOwnProperty("hi");         // true
```

### Differences from constructor functions

| Behaviour | Function constructor | Class |
|---|---|---|
| Call without `new` | works (bug-prone) | TypeError |
| Hoisting | declaration hoisted with value | hoisted but in TDZ |
| Strict mode | opt-in | always |
| Method enumerability | enumerable if assigned | non-enumerable |
| Inheritance | manual prototype wiring | `extends`/`super` |
| Private state | closures/WeakMap | `#private` |

### Instance vs prototype members

```js
class A {
  field = 1;           // own property on each instance
  method() {}          // shared on A.prototype
  arrow = () => {};    // own property, new function per instance
}
```

### Static members
Live on the constructor itself and are inherited by subclasses (`B.__proto__ === A`).

### Getters and setters
Defined on the prototype as accessor properties.

## Follow-ups
- **Are classes hoisted?** — Yes, but accessing before declaration throws a ReferenceError (TDZ).
- **Do classes provide real encapsulation?** — Only with `#private` members; `_name` is a convention.

## Common Mistakes
- Saying classes introduce a new class-based object model; they don't.
- Placing arrow-function fields and then expecting them on the prototype for mocking/spying.

## Tips
- Show `Person.prototype.hi` to prove methods are shared, then list two real differences beyond sugar.
