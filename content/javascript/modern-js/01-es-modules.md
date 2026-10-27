---
title: "How do ES modules work, and how do they differ from CommonJS?"
level: medium
type: concept
tags: [modules, esm, commonjs, import, export, dynamic-import]
related: [javascript/iife-module-pattern, javascript/this-binding-rules, nextjs/code-splitting-lazy]
---

## Question
Explain ES modules: named vs default exports, live bindings, static analysis, dynamic `import()`, and the key differences from CommonJS (`require`).

## Interview Answer
ES modules use `import` and `export` statements that are statically analysable, so bundlers can tree-shake unused exports and the engine can build the dependency graph before running any code. Exports are live bindings, not copies: an importer sees later changes to the exported variable. Modules are strict mode by default, have their own scope, are singletons per URL, and support top-level `await`. CommonJS uses `require` and `module.exports`, loads synchronously at runtime, and exports a copy of the value at require-time. For code splitting I use dynamic `import()`, which returns a promise of the module and can be called conditionally.

## Explanation
### Syntax

```js
// math.js
export const PI = 3.14;
export function add(a, b) { return a + b; }
export default class Calculator {}

// app.js
import Calculator, { PI, add as sum } from "./math.js";
import * as math from "./math.js";
export { sum };                 // re-export
export * from "./other.js";
```

### Differences from CommonJS

| | ESM | CommonJS |
|---|---|---|
| Syntax | `import` / `export` | `require()` / `module.exports` |
| Loading | static graph, async-capable | dynamic, synchronous |
| Exports | live bindings | value copy at require time |
| Tree-shaking | yes | hard |
| `this` at top level | `undefined` | `module.exports` |
| `__dirname` | use `import.meta.url` | available |
| Top-level `await` | yes | no |
| Conditional import | `import()` | `require()` anywhere |

### Live bindings

```js
// counter.js
export let count = 0;
export function inc() { count++; }

// main.js
import { count, inc } from "./counter.js";
inc();
console.log(count);   // 1  (live)
count = 5;            // TypeError: imports are read-only
```

### Dynamic import and splitting

```js
button.onclick = async () => {
  const { default: Chart } = await import("./chart.js");
  new Chart(el);
};
```

In React: `lazy(() => import("./Heavy"))`; in Next.js: `next/dynamic`.

### Circular dependencies
ESM handles cycles through live bindings, but accessing an export before it is initialised throws a TDZ ReferenceError; CommonJS returns a partially filled `module.exports`.

### Browsers and Node
Use `<script type="module">` (deferred by default). In Node, use `.mjs` or `"type": "module"`. Node can `require()` ESM in recent versions (22+), but interop is still a source of errors.

### Default vs named exports
Named exports give better refactoring and tree-shaking, and consistent names; default exports are required by some conventions (Next.js pages, `React.lazy`).

## Follow-ups
- **What is tree-shaking?** — Dropping unused exports at build time, enabled by static imports and side-effect-free modules (`sideEffects: false`).
- **Are modules executed multiple times if imported twice?** — No; evaluated once and cached.

## Common Mistakes
- Thinking imports are copies.
- Using `import()` in a loop without realising it is cached after the first load.

## Tips
- Say "static, live-bound, singleton" and mention dynamic `import()` for splitting.
