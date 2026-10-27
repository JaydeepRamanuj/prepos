---
title: "What is the difference between CommonJS and ES modules in Node.js?"
level: medium
type: concept
tags: [node, modules, esm, commonjs, require, import]
related: [backend/node-event-loop]
---

## Question
What are the differences between CommonJS (`require`/`module.exports`) and ES modules (`import`/`export`) in Node.js? How does Node decide which one a file is, and can you mix them?

## Interview Answer
CommonJS is Node's original module system: `require()` is a synchronous function you can call anywhere, and it returns a copy of whatever `module.exports` was. ES modules are the language standard: `import`/`export` are static declarations, so they're resolved and linked before the code runs. That enables tree-shaking and top-level `await`, and imports are live bindings rather than copies. Node decides by file: `.mjs` is always ESM, `.cjs` is always CommonJS, and a `.js` file follows the `"type"` field of the nearest `package.json`. In ESM, `__dirname` and `require` don't exist; you use `import.meta.dirname` or `import.meta.url` instead, and relative imports need the file extension. Mixing used to be painful, but modern Node can `require()` an ES module as long as it has no top-level `await`, and ESM has always been able to `import` CommonJS.

## Explanation
### Side by side
```js
// math.cjs (CommonJS)
function add(a, b) { return a + b; }
module.exports = { add };

// app.cjs
const { add } = require("./math.cjs"); // sync, can be inside an if
```

```js
// math.mjs (ESM)
export function add(a, b) { return a + b; }

// app.mjs
import { add } from "./math.mjs"; // static, hoisted, extension required
const config = await import("./config.mjs"); // dynamic import is async
```

| | CommonJS | ES modules |
|---|---|---|
| Syntax | `require` / `module.exports` | `import` / `export` |
| Loading | synchronous, at runtime | parsed and linked first, evaluated async |
| Exports | a value (copy of `module.exports`) | live bindings |
| Top-level `await` | no | yes |
| Tree-shaking | hard (dynamic) | easy (static) |
| `__dirname`, `__filename`, `require` | available | not available; use `import.meta.dirname` / `import.meta.filename` |
| Extensions in relative paths | optional | required (`./util.js`) |
| `this` at top level | `module.exports` | `undefined` |

### How Node picks the format
1. `.mjs` → ESM, `.cjs` → CommonJS, always.
2. `.js` → the nearest `package.json` `"type"`: `"module"` means ESM; `"commonjs"` or no field means CommonJS.
3. No `"type"` field and the file contains ESM-only syntax (`import`/`export` statements)? Current Node (enabled by default since v22.7 and v20.19) detects that and runs it as ESM, at a small startup cost. Node's docs recommend always setting `"type"` explicitly.

### Live bindings vs copies
```js
// counter.mjs
export let count = 0;
export function inc() { count++; }

// main.mjs
import { count, inc } from "./counter.mjs";
inc();
console.log(count); // 1 — the binding is live
```
With CommonJS, `const { count } = require("./counter.cjs")` copies the number at require time and would still print `0`.

### Mixing them
- **ESM importing CJS** — always works: `import pkg from "./legacy.cjs"` gives you `module.exports` as the default export; named imports work when Node can detect them statically.
- **CJS requiring ESM** — historically threw `ERR_REQUIRE_ESM`, so you had to use `await import()`. Since Node v22.12 and v20.19, `require(esm)` is enabled by default for ES modules with no top-level `await` (otherwise `ERR_REQUIRE_ASYNC_MODULE`). Node still labels it experimental, so check your Node version before relying on it.

### Practical defaults today
- New projects: `"type": "module"` and ESM everywhere.
- In a Next.js app you write ESM, and the bundler handles the interop. The CJS/ESM question mainly comes up in Node scripts, tooling config files (`*.config.cjs` vs `*.config.mjs`) and publishing npm packages (the `"exports"` field with `"import"`/`"require"` conditions).

## Follow-ups
- **What is the `"exports"` field in package.json?** — It defines the package's public entry points and can map `import` and `require` to different files; anything not listed can't be imported.
- **What's the "dual package hazard"?** — If a package ships separate CJS and ESM builds, an app can load both copies, so you get two instances of internal state (e.g. two singletons or failing `instanceof` checks).
- **How do you get `__dirname` in ESM?** — `import.meta.dirname` in current Node, or `path.dirname(fileURLToPath(import.meta.url))` on older versions.

## Common Mistakes
- Forgetting the `.js` extension in relative ESM imports, which gives `ERR_MODULE_NOT_FOUND`.
- Assuming `require` of an ESM package always fails. That's outdated on current Node.
- Saying ESM exports are copies, or CJS exports are live. It's the reverse.

## Tips
- Remember: **CJS = function call at runtime; ESM = static declaration resolved before running**. Every other difference (tree-shaking, top-level await, live bindings, no `__dirname`) follows from that.
- Mention the version change for `require(esm)`. Interviewers like "it used to be X, now it's Y".
