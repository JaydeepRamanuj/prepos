---
title: "Optional chaining, nullish coalescing and logical assignment: how do they differ from || and &&?"
level: easy
type: concept
tags: [optional-chaining, nullish-coalescing, logical-assignment, falsy]
related: [javascript/null-vs-undefined, javascript/type-coercion, javascript/destructuring-spread-edge-cases]
---

## Question
What do `?.`, `??`, `??=`, `||=` and `&&=` do? Why is `??` safer than `||` for defaults?

## Interview Answer
Optional chaining `a?.b` short-circuits to `undefined` if `a` is `null` or `undefined` instead of throwing, and also works for calls `fn?.()` and indexing `a?.[k]`. Nullish coalescing `a ?? b` returns `b` only when `a` is `null` or `undefined`, whereas `a || b` returns `b` for any falsy value, which wrongly replaces `0`, `""` and `false`. Logical assignment operators combine this with assignment: `a ??= b` assigns only if `a` is nullish, `a ||= b` if falsy, and `a &&= b` if truthy, and they short-circuit so no assignment happens otherwise. I use `??` for defaults and `?.` for reading optional data.

## Explanation
### Optional chaining

```js
user?.address?.city;        // undefined if user or address is nullish
user.getName?.();           // call only if method exists
arr?.[0];
delete obj?.prop;
```

It short-circuits the entire rest of the chain: in `a?.b.c.d`, if `a` is nullish, nothing after is evaluated. It does not guard against non-nullish values with missing properties deeper, e.g. `a?.b.c` throws if `b` is undefined.

### `??` vs `||`

```js
const count = 0;
count || 10;      // 10   (bug: 0 is a valid count)
count ?? 10;      // 0
"" ?? "default";  // ""
null ?? "default";// "default"
```

Mixing `??` with `||` or `&&` without parentheses is a SyntaxError.

### Logical assignment

```js
opts.timeout ??= 3000;        // set default only if null/undefined
user.name ||= "Anonymous";    // replace any falsy
cache.value &&= transform(cache.value);
```

They short-circuit, so setters are not called when no assignment is needed, unlike `a = a ?? b`.

### Default parameters and destructuring defaults
They apply only to `undefined`, not `null`:

```js
function f(x = 5) { return x; }
f(null);       // null
f(undefined);  // 5
```

### Caveats
- Overusing `?.` hides bugs: if data must exist, let it throw.
- TypeScript narrows types through `?.` and `??`.
- Supported in all modern browsers and Node 14+.

## Follow-ups
- **What does `null?.x` evaluate to?** — `undefined`.
- **Is `a ?? b` the same as `a != null ? a : b`?** — Yes, for single evaluation of `a`.

## Common Mistakes
- Using `||` for defaults where `0` or `""` is valid.
- Chaining `?.` everywhere "just in case".

## Tips
- The `count || 10` example is the fastest way to show you understand the difference.
