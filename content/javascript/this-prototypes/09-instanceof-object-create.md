---
title: "How does instanceof work? Implement it and Object.create"
level: advanced
type: implement
tags: [instanceof, Object.create, prototype, polyfill, Symbol.hasInstance]
related: [javascript/prototype-chain, javascript/new-keyword-implementation, javascript/classes-vs-prototypes]
---

## Question
Explain what `a instanceof B` checks, then implement `myInstanceOf(obj, Ctor)` and a simplified `Object.create(proto)`.

```js
class A {}
class B extends A {}
const b = new B();
myInstanceOf(b, A);                 // true
myInstanceOf({}, A);                // false
myInstanceOf(5, Number);            // false

const o = myCreate({ hi: 1 });
o.hi;                               // 1
Object.getPrototypeOf(o);           // { hi: 1 }
```

## Clues
- `instanceof` walks one chain and compares it to a property of the right-hand function.
- Which property of `Ctor` do you compare, and where does the walk stop?
- To create an object with a chosen prototype without `Object.create`, think of `new` with a temporary constructor.

## Interview Answer
`obj instanceof Ctor` is true if `Ctor.prototype` appears anywhere in `obj`'s prototype chain. The algorithm: if `Ctor` defines `Symbol.hasInstance`, use it; otherwise take `Ctor.prototype`, then loop from `Object.getPrototypeOf(obj)` upward, returning true on a match and false on reaching `null`. Primitives are always false. `Object.create(proto)` makes a new empty object whose `[[Prototype]]` is `proto`; the classic polyfill makes a throwaway function `F`, sets `F.prototype = proto`, and returns `new F()`. Both show that inheritance is just a linked chain, and `instanceof` is fooled if you reassign `Ctor.prototype` later.

## Explanation
### `instanceof`

```js
function myInstanceOf(obj, Ctor) {
  if (typeof Ctor !== "function") {
    throw new TypeError("Right-hand side must be callable");
  }
  // objects only: primitives are never instances
  if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) {
    return false;
  }
  const target = Ctor.prototype;
  let proto = Object.getPrototypeOf(obj);
  while (proto !== null) {
    if (proto === target) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

The real operator first checks `Ctor[Symbol.hasInstance]`:

```js
class Even {
  static [Symbol.hasInstance](n) { return n % 2 === 0; }
}
2 instanceof Even; // true
```

### `Object.create`

```js
function myCreate(proto, props) {
  if (typeof proto !== "object" && typeof proto !== "function") {
    throw new TypeError("Prototype must be an object or null");
  }
  function F() {}
  F.prototype = proto;
  const obj = new F();
  if (proto === null) Object.setPrototypeOf(obj, null);
  if (props) Object.defineProperties(obj, props);
  return obj;
}
```

(`Object.create` is built in; this shows the idea, and `null` needs `setPrototypeOf`.)

### Old-style inheritance with it

```js
function Animal(n) { this.name = n; }
Animal.prototype.speak = function () { return this.name; };

function Dog(n) { Animal.call(this, n); }
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;     // restore, otherwise points to Animal
```

### Limits of `instanceof`
- Fails across realms (iframes): their `Array` differs. Use `Array.isArray`.
- Changes if `Ctor.prototype` is reassigned after creating instances.
- Cannot test interfaces/duck types; use structural checks.

### Complexity
O(depth of the chain).

## Follow-ups
- **`Object.create(null)` use?** — A dictionary without inherited keys like `toString`.
- **Difference from `isPrototypeOf`?** — `A.prototype.isPrototypeOf(obj)` does the chain check without needing a constructor.

## Common Mistakes
- Comparing `obj.__proto__ === Ctor.prototype` only, missing deeper ancestors.
- Forgetting to reset `constructor` after replacing a prototype.

## Tips
- Say "walk the chain until `null`" before you write any code.
