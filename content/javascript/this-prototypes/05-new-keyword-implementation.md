---
title: "What does the `new` operator do? Implement it yourself"
level: hard
type: implement
tags: [new, constructor, prototype, polyfill]
related: [javascript/prototype-chain, javascript/this-binding-rules, javascript/instanceof-object-create]
---

## Question
List the steps `new Foo(args)` performs. Then write a function `myNew(Constructor, ...args)` that behaves the same.

```js
function Person(name) { this.name = name; }
Person.prototype.hi = function () { return "hi " + this.name; };

const p = myNew(Person, "Asha");
p.hi();                    // "hi Asha"
p instanceof Person;       // true
```

## Clues
- A new empty object must be linked to the constructor's `prototype`.
- The constructor needs to run with `this` set to that object.
- What if the constructor explicitly returns something?

## Interview Answer
`new` creates a fresh object whose `[[Prototype]]` is `Constructor.prototype`, calls the constructor with `this` bound to that object and the given arguments, and then returns either that object or, if the constructor returned an object itself, that returned object. Primitives returned from a constructor are ignored. My `myNew` does exactly that: `Object.create(Constructor.prototype)`, `Constructor.apply(obj, args)`, then `return result instanceof Object ? result : obj`. A more precise check treats functions as objects too.

## Explanation
### The four steps
1. Create an empty object.
2. Set its prototype to `Constructor.prototype`.
3. Run the constructor with `this` = that object.
4. Return the object, unless the constructor returned an object (or function).

### Implementation

```js
function myNew(Constructor, ...args) {
  if (typeof Constructor !== "function") {
    throw new TypeError("Constructor must be a function");
  }
  // steps 1 + 2: object linked to the prototype
  const obj = Object.create(Constructor.prototype);
  // step 3: run constructor with this = obj
  const result = Constructor.apply(obj, args);
  // step 4: an explicitly returned object wins
  const isObject =
    result !== null && (typeof result === "object" || typeof result === "function");
  return isObject ? result : obj;
}
```

### Edge cases

```js
function A() { return { custom: true }; }
myNew(A);            // { custom: true }  (returned object replaces `this`)

function B() { this.x = 1; return 42; }
myNew(B);            // { x: 1 }  (primitive return ignored)
```

### What the real `new` also does
- Throws for arrow functions, methods and async functions (no `[[Construct]]`).
- Class constructors cannot be called without `new`; with `Reflect.construct` you can handle those, and derived classes need `new.target`. A faithful polyfill for classes: `Reflect.construct(Constructor, args)`.
- Sets `new.target` inside the constructor.

### Complexity
Constant overhead on top of the constructor.

## Follow-ups
- **What happens if you call a constructor function without `new`?** — `this` is default-bound (undefined in strict mode), so assignments fail or leak onto `window`.
- **What is `new.target`?** — Inside a function, it refers to the constructor invoked with `new`, or `undefined` for a plain call.

## Common Mistakes
- Forgetting to link the prototype, so methods are missing.
- Always returning `obj` and ignoring an object returned by the constructor.

## Tips
- Memorise `Object.create` → `apply` → return rule. It is short enough to write on a whiteboard.
