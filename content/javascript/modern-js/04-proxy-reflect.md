---
title: "What are Proxy and Reflect, and where are they used?"
level: advanced
type: concept
tags: [proxy, reflect, metaprogramming, reactivity, traps]
related: [javascript/class-fields-private-static, javascript/prototype-chain, javascript/symbols-well-known]
---

## Question
What does a `Proxy` do, what are traps, and why is `Reflect` usually used with it? Give practical uses (validation, reactivity) and limitations.

## Clues
- A proxy wraps a target and intercepts fundamental operations such as get, set, has and delete.
- Without forwarding the default behaviour correctly, getters and `this` can break.
- Think of how Vue 3 tracks reads and writes.

## Interview Answer
`new Proxy(target, handler)` creates an object that intercepts fundamental operations on the target through handler traps like `get`, `set`, `has`, `deleteProperty`, `ownKeys` and `apply`. Inside a trap I can validate, log, add default values or trigger side effects, and then forward to the default behaviour with `Reflect.get/set`, which mirrors each trap and handles receivers and return values correctly. Vue 3 reactivity is built this way: `get` tracks dependencies and `set` triggers updates. Limitations are that proxies add overhead, cannot intercept operations on the target made without the proxy, and break things relying on internal slots, such as private `#fields`, `Map` methods and `Date` unless methods are bound.

## Explanation
### Validation example

```js
const person = new Proxy({}, {
  set(target, key, value, receiver) {
    if (key === "age" && !Number.isInteger(value)) {
      throw new TypeError("age must be an integer");
    }
    return Reflect.set(target, key, value, receiver);   // forward, return boolean
  },
});
person.age = 30;     // ok
person.age = "x";    // TypeError
```

### Default values and logging

```js
const withDefault = (obj, fallback) =>
  new Proxy(obj, {
    get: (t, k, r) => (k in t ? Reflect.get(t, k, r) : fallback),
  });
```

### Mini reactivity

```js
function reactive(obj, onChange) {
  return new Proxy(obj, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      return typeof v === "object" && v !== null ? reactive(v, onChange) : v;
    },
    set(t, k, v, r) {
      const ok = Reflect.set(t, k, v, r);
      onChange(k);
      return ok;
    },
  });
}
```

Immer uses proxies to record mutations on a draft; Vue 3 and MobX do similar tracking.

### Why Reflect
- Same operations as traps, returning booleans instead of throwing: `Reflect.defineProperty` vs `Object.defineProperty`.
- Passing `receiver` keeps `this` correct for getters and inheritance.
- Required for `set` traps to return `true` in strict mode (otherwise TypeError).

### Common traps
`get`, `set`, `has` (`in`), `deleteProperty`, `ownKeys` (`Object.keys`), `getOwnPropertyDescriptor`, `apply` (function calls), `construct` (`new`).

### Limitations
- Private fields and internal slots: `new Proxy(new Map(), {}).get("a")` throws because `this` is the proxy.
- Identity: `proxy !== target`.
- Performance cost on hot paths.
- Cannot be polyfilled.
- Invariants: a trap may not lie about non-configurable, non-writable properties.

### Revocable proxies
`Proxy.revocable(target, handler)` gives `{ proxy, revoke }` for access that can be cut off.

## Follow-ups
- **Proxy vs `Object.defineProperty`?** — Vue 2 used `defineProperty` and could not detect added/deleted keys; proxies intercept everything.
- **Can you proxy a function?** — Yes, with the `apply` trap.

## Common Mistakes
- Forgetting to return `true` from `set`.
- Using `target[key]` instead of `Reflect.get(..., receiver)`, breaking inherited getters.

## Tips
- Mention Vue 3 and Immer as real examples; it shows you know where proxies pay off.
