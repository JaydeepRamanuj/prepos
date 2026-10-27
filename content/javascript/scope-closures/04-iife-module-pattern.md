---
title: "What is an IIFE and the module pattern, and are they still relevant with ES modules?"
level: medium
type: concept
tags: [iife, module-pattern, closures, es-modules, encapsulation]
related: [javascript/closure, javascript/closure-private-state-store, javascript/closure-loop-settimeout]
---

## Question
What is an IIFE? What is the "revealing module pattern", what problem did it solve, and do you still need either now that we have ES modules?

## Interview Answer
An IIFE — Immediately Invoked Function Expression — is a function expression that is called as soon as it is defined, like `(() => { ... })()`. Its purpose is to create a private scope: anything declared inside does not leak into the global scope. The module pattern builds on it — the IIFE keeps state and helpers private and returns an object exposing only the public API, using closures to keep the private parts alive. Before ES modules every `<script>` shared the global scope, so this was the main way to avoid name collisions; jQuery plugins and old libraries are full of it. Today ES modules give each file its own scope and explicit `export`s, so I rarely write IIFEs for encapsulation, but they still appear for running async code at top level in CommonJS, isolating a one-off block, and in bundler output.

## Explanation
### Syntax

```js
(function () {
  const secret = 42; // not visible outside
})();

(() => {
  // arrow version
})();

;(function () {})(); // leading ; protects against a previous line without one
```

The wrapping parentheses turn the `function` keyword into an *expression*; `function () {}()` on its own is parsed as a declaration and is a SyntaxError.

### The revealing module pattern

```js
const cart = (function () {
  const items = [];                     // private state

  function total() {                    // private helper
    return items.reduce((sum, i) => sum + i.price, 0);
  }

  function add(item) {
    items.push(item);
  }

  return { add, total };                // "reveal" only what is public
})();

cart.add({ price: 100 });
cart.total();   // 100
cart.items;     // undefined
```

The returned functions close over `items`, so the state lives as long as `cart` does, but no outside code can touch it.

### Why it mattered

```html
<script src="a.js"></script> <!-- var config = {...} -->
<script src="b.js"></script> <!-- var config = {...}  ← overwrites a.js -->
```

Every top-level `var` in a classic script became a property of `window`. IIFEs were how libraries survived that.

### ES modules make it mostly unnecessary

```js
// cart.js
const items = [];                      // module-scoped, private
export function add(item) { items.push(item); }
export function total() { /* ... */ }
```

| | IIFE module | ES module |
|---|---|---|
| Private scope | function scope | file scope |
| Public API | returned object | `export` |
| Dependencies | globals / arguments | `import` (statically analysable) |
| Tree-shaking | no | yes |
| Singleton | yes | yes — evaluated once per realm |

### Where IIFEs still show up

```js
// 1. Async code where top-level await is unavailable (e.g. CommonJS scripts)
(async () => {
  const data = await load();
  console.log(data);
})();

// 2. Computing a const with complex logic
const label = (() => {
  if (count === 0) return "empty";
  if (count === 1) return "1 item";
  return `${count} items`;
})();
```

You will also see IIFEs in bundled output and in UMD builds.

## Follow-ups
- **Is a module-scoped variable shared between all importers?** — Yes. A module is evaluated once and every importer gets the same live bindings, which makes module-level state a singleton (useful for caches, dangerous on a server where it is shared across requests).
- **What is UMD?** — Universal Module Definition: an IIFE wrapper that detects CommonJS, AMD or a browser global and exports accordingly.
- **Why the leading semicolon?** — If the previous line has no semicolon, `(` could be parsed as a function call on it.

## Common Mistakes
- Forgetting the wrapping parentheses and getting a SyntaxError.
- Thinking IIFEs are needed for privacy in ES modules.
- Storing per-user state in module scope in server code (Next.js server components, API routes) — it leaks across requests.

## Tips
- Frame it historically: "global scope collisions → IIFE → module pattern → ES modules". It shows you understand *why* the tool exists.
- The `const label = (() => {...})()` trick is a nice practical example to mention.
