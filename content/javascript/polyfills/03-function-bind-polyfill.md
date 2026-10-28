---
title: "Implement Function.prototype.bind (and call/apply)"
level: hard
type: implement
tags: [bind, call, apply, this, polyfill]
related: [javascript/call-apply-bind, javascript/this-binding-rules, javascript/new-keyword-implementation]
---

## Question
Write `Function.prototype.myBind(thisArg, ...preset)` that returns a bound function. It should support partial application and still work when the bound function is called with `new`. Then implement `myCall` and `myApply`.

```js
function greet(greeting, name) { return `${greeting}, ${name} from ${this.city}`; }
const hi = greet.myBind({ city: "Pune" }, "Hi");
hi("Asha");   // "Hi, Asha from Pune"
```

## Clues
- `call`/`apply` can be built by temporarily putting the function on the object as a property.
- Use a unique key so you do not overwrite an existing property, and clean up afterwards.
- With `new`, the bound `this` must be ignored and the prototype chain preserved.

## Interview Answer
For `bind` I return a closure that calls the original with `apply`, using `thisArg` and the preset arguments concatenated with the arguments at call time. To support `new`, I check `this instanceof bound`: if the bound function was called as a constructor, I use the new `this` instead of `thisArg`, and I link `bound.prototype` to the original's prototype. For `call` and `apply`, I attach the function to a copy of the target object under a `Symbol` key, invoke it as a method so `this` is that object, and delete the key. Primitives need to be boxed with `Object()`, and `null`/`undefined` fall back to the global object in sloppy mode.

## Explanation
### `myCall` and `myApply`

```js
Function.prototype.myCall = function (context, ...args) {
  if (typeof this !== "function") throw new TypeError("not callable");
  context = context == null ? globalThis : Object(context);   // box primitives
  const key = Symbol("fn");           // cannot collide with existing keys
  context[key] = this;                // `this` is the function being called
  try {
    return context[key](...args);     // method call: this === context
  } finally {
    delete context[key];
  }
};

Function.prototype.myApply = function (context, args = []) {
  return this.myCall(context, ...Array.from(args));
};
```

### `myBind`

```js
Function.prototype.myBind = function (thisArg, ...preset) {
  const fn = this;
  if (typeof fn !== "function") throw new TypeError("Bind must be called on a function");

  function bound(...args) {
    // called with `new`? then `this` is an instance of bound: ignore thisArg
    const context = this instanceof bound ? this : thisArg;
    return fn.apply(context, [...preset, ...args]);
  }

  // keep prototype chain so `new bound()` instances inherit from fn.prototype
  if (fn.prototype) {
    bound.prototype = Object.create(fn.prototype);
  }
  return bound;
};
```

### Behaviour check

```js
function Point(x, y) { this.x = x; this.y = y; }
const Origin = Point.myBind(null, 0);
const p = new Origin(5);
p.x; p.y;                    // 0, 5
p instanceof Point;          // true
```

### Edge cases
- `this instanceof bound` is the classic check; modern code can use `new.target`.
- A real `bound` function has no `prototype` property, name `"bound fn"`, and `length` reduced by preset count; this polyfill skips those details.
- Arrow functions ignore the bound `this`.
- A frozen target object would make `myCall` fail; the Symbol-on-object trick requires an extensible object (`Reflect.apply(fn, thisArg, args)` is the correct modern way without the hack).

### Complexity
O(args) per call.

## Follow-ups
- **Why use a Symbol key?** — To avoid clobbering a user property with the same name.
- **Can you implement `bind` using `Reflect.apply`?** — Yes: `Reflect.apply(fn, context, [...preset, ...args])`.

## Common Mistakes
- Forgetting to remove the temporary property.
- Ignoring `new`.

## Tips
- Mention the `new` case unprompted; most candidates miss it.
