---
title: "How is `this` determined in JavaScript?"
level: medium
type: concept
tags: [this, binding, call-site, strict-mode]
related: [javascript/call-apply-bind, javascript/arrow-functions-this, javascript/this-call-sites-output]
---

## Question
Explain how the value of `this` is decided for a normal function. What are the binding rules and their priority?

## Interview Answer
For a normal function, `this` is decided by how the function is called, not where it is defined. There are four rules in priority order: `new` binding, where `this` is the newly created object; explicit binding with `call`, `apply` or `bind`; implicit binding, where `obj.method()` makes `this` be `obj`; and the default, where `this` is `undefined` in strict mode and the global object otherwise. A method taken off its object, like `const f = obj.method; f()`, loses implicit binding and falls to the default. Arrow functions do not follow these rules: they capture `this` lexically from the enclosing scope.

## Explanation
### The rules

```js
function show() { return this?.name; }
const obj = { name: "obj", show };

obj.show();             // "obj"        implicit
const f = obj.show;
f();                    // undefined    default (strict mode; ES modules and classes are strict)
show.call({ name: "x" });  // "x"       explicit
const bound = show.bind({ name: "b" });
bound.call({ name: "z" }); // "b"       bind wins over later call
new show();             // this = new object; (returns that object)
```

### Priority
`new` > `bind`/`call`/`apply` > `obj.method()` > default.

### Losing `this`
Passing a method as a callback detaches it:

```js
class Counter {
  count = 0;
  inc() { this.count++; }
}
const c = new Counter();
setTimeout(c.inc, 0);          // this is undefined -> TypeError
setTimeout(() => c.inc(), 0);  // fine
setTimeout(c.inc.bind(c), 0);  // fine
```

In React class components this was why handlers were bound in the constructor.

### Where `this` comes from in other places
- Top level of a module: `undefined`; in a classic script: `window`.
- DOM event handler added with `addEventListener` (normal function): the element, i.e. `event.currentTarget`.
- Getter/setter: the object the property is accessed on.

### Strict vs sloppy
In sloppy mode, an undefined `this` is replaced by the global object, and primitives are boxed. In strict mode they are left alone.

## Follow-ups
- **What is `this` inside a nested function in a method?** — Default binding again (undefined in strict mode), unless it is an arrow.
- **What about `setTimeout(obj.method, 0)`?** — Default binding; in browsers sloppy mode gives `window`.

## Common Mistakes
- Believing `this` refers to where the function was written.
- Forgetting that destructuring a method detaches it.

## Tips
- Ask yourself "what is to the left of the dot at the call site?" first, then check for `new`, `bind` and arrows.
