---
title: "How do `extends` and `super` work in class inheritance?"
level: hard
type: concept
tags: [classes, extends, super, inheritance, constructors]
related: [javascript/classes-vs-prototypes, javascript/prototype-chain, javascript/class-fields-private-static]
---

## Question
What does `extends` set up under the hood? What are the rules for `super()` in constructors and `super.method()` in methods? What happens if you forget `super()`?

## Clues
- Two prototype links are created: one for instances and one for the constructors.
- In a derived class, `this` does not exist until something happens.
- `super.method()` is looked up from the parent prototype, not from the instance.

## Interview Answer
`class B extends A` links two chains: `B.prototype.__proto__` is `A.prototype`, so instances inherit A's methods, and `B.__proto__` is `A`, so static members are inherited too. In a derived constructor, `this` is not created until `super(...)` runs, because the parent constructor allocates the object; touching `this` before it or returning without calling it throws a ReferenceError. `super.method()` calls the parent's version using the method's home object, so it works regardless of how the method was called, though `this` is still the current instance. This design also lets subclasses extend built-ins like `Array` and `Error` correctly.

## Explanation
### Setup

```js
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
  static kingdom() { return "animalia"; }
}

class Dog extends Animal {
  constructor(name) {
    super(name);              // must come before `this`
    this.tricks = [];
  }
  speak() {
    return super.speak() + " (woof)";
  }
}

const d = new Dog("Rex");
d.speak();                    // "Rex makes a sound (woof)"
Dog.kingdom();                // "animalia"
```

```txt
instances: d -> Dog.prototype -> Animal.prototype -> Object.prototype
statics:   Dog -> Animal -> Function.prototype
```

### Rules
- Derived constructor must call `super()` before using `this`, unless it returns an object.
- If you omit the constructor, one is generated: `constructor(...args) { super(...args); }`.
- `super.x` in object-literal methods works too (uses the object's `[[HomeObject]]`).
- Field initialisers of the derived class run right after `super()` returns.

### Built-in subclassing

```js
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
new HttpError(404, "Not found") instanceof Error; // true, with stack trace
```

ES5 function-based inheritance could not subclass `Array` or `Error` properly.

### Composition vs inheritance
Deep hierarchies couple subclasses to parents. Prefer composition (pass collaborators in) unless there is a genuine "is-a" relationship. React moved from class inheritance to hooks and composition for this reason.

### Overriding trap

```js
class Parent {
  constructor() { this.init(); }
  init() {}
}
class Child extends Parent {
  value = 1;
  init() { console.log(this.value); }   // undefined: Child fields not yet set
}
new Child();
```

## Follow-ups
- **What is `super` inside a static method?** — The parent class constructor.
- **Can you extend `null` or a function constructor?** — You can extend any constructor, including old-style functions.

## Common Mistakes
- Using `this` before `super()`.
- Calling overridable methods from a base constructor.

## Tips
- Show the two-chain diagram; it answers most follow-ups at once.
