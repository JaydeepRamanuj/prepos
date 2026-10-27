---
title: "What is the React Compiler, what does it require, and does it replace useMemo?"
level: advanced
type: concept
tags: [react-compiler, memoization, rules-of-react, build-tools]
related: [react/memoization-cost-benefit, react/react-memo-new-props, react/react-18-to-19-changes]
---

## Question
Explain what the React Compiler does, how it decides what to optimise, what your code must satisfy for it to work, and how you would adopt it in an existing Next.js app.

## Clues
- It runs at build time, not at runtime. What does it insert into your components?
- It assumes components are pure and follow the Rules of React. What happens when they don't?
- Think about how you would roll it out gradually and opt specific components out.

## Interview Answer
The React Compiler is a build-time Babel plugin (`babel-plugin-react-compiler`) that automatically memoizes components and hooks. It analyses each component's data flow and caches JSX, derived values and callbacks so they are recomputed only when their inputs change. That gives you the effect of `memo`, `useMemo` and `useCallback` without writing them, and it can even memoize after an early return. Version 1.0 has been stable since October 2025. It works with React 17 and up, and on 17 or 18 you also install `react-compiler-runtime` and set a `target`. It relies on your code following the Rules of React: pure render, no mutation of props or state, and hooks called unconditionally. When it can't prove a component is safe, the default setting skips that component instead of failing the build. In Next.js 16, I install the plugin, set `reactCompiler: true` in `next.config.ts`, turn on the compiler lint rules in `eslint-plugin-react-hooks`, and use `"use no memo"` to opt out any component that breaks.

## Explanation
### What it actually does
You write plain code:

```tsx
function ProductList({ products, onSelect }: Props) {
  const visible = products.filter((p) => p.inStock);
  const handle = (id: string) => onSelect(id);
  return visible.map((p) => <Row key={p.id} product={p} onClick={handle} />);
}
```

The compiler rewrites it into code that keeps a per-component cache (imported from `react/compiler-runtime`) and reuses `visible`, `handle` and the JSX when `products` and `onSelect` are unchanged. Because the returned `<Row>` elements are cached, React skips re-rendering them, which is the same effect as wrapping `Row` in `memo`.

What it does **not** do:
- It does not memoize plain utility functions outside components and hooks.
- It does not share a cache across components (this is not a global memo cache).
- It does not make expensive code fast. It only avoids repeating that work.

### Which functions get compiled
The default `compilationMode` is `'infer'`. A function is compiled if it is named like a component (PascalCase) or a hook (`use` prefix) **and** it creates JSX or calls hooks. A `"use memo"` directive forces a function in, and `"use no memo"` always keeps it out. In `'annotation'` mode only functions marked with `"use memo"` are compiled, which is useful for a gradual rollout.

### Requirements: the Rules of React
The compiler memoizes based on the assumption that the same inputs give the same output. Code that breaks this assumption is unsafe to cache:

```tsx
function Bad({ items }: { items: Item[] }) {
  items.sort(byName);            // mutates a prop
  const now = Date.now();        // impure value read during render
  if (items.length === 0) return null;
  const [open, setOpen] = useState(false); // conditional hook
  // ...
}
```

The default `panicThreshold: 'none'` means the compiler **skips** functions it can't compile safely. They run unoptimised and the build continues. The real danger is code that breaks the rules in ways the compiler cannot detect, because then it may cache something that should have changed. That is why the lint rules matter.

### Adopting it in Next.js 16

```bash
npm install -D babel-plugin-react-compiler
```

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true, // stable since Next.js 16, but not on by default
  // or, for a gradual rollout: reactCompiler: { compilationMode: "annotation" },
};

export default nextConfig;
```

Rollout plan:
1. Enable the compiler-powered rules in `eslint-plugin-react-hooks` (the `recommended` preset) and fix the violations first. The linter works even before the compiler is installed.
2. Turn on the compiler, then verify with React DevTools, where compiled components show a "Memo ✨" badge.
3. Profile the key interactions before and after.
4. If a component misbehaves, add `"use no memo"` at the top of its body, file a fix, then remove the directive.

### What about existing useMemo/useCallback?
The React docs' guidance: in new code, rely on the compiler and use the manual hooks only when you need precise control, for example to keep an effect dependency stable. In existing code, leave the manual memoization in place unless you test its removal, because removing it can change the compiled output.

### Status by framework
- **Expo SDK 54+**: enabled by default.
- **Vite / create-next-app**: offer compiler-enabled templates.
- **Next.js 16**: `reactCompiler` is a stable config option, off by default. Next.js applies the Babel plugin only to relevant files to keep builds fast.

## Follow-ups
- **Why a compiler instead of a runtime solution?** Static analysis can see exactly which values each piece of JSX depends on and memoize at a finer level than a human would, with no API for you to learn.
- **Does it slow builds?** Somewhat, because it runs through Babel. Next.js limits this by applying it only to files with JSX or hooks.
- **Does it fix context re-renders?** No. It only memoizes. A consumer still re-renders when the context value changes.

## Common Mistakes
- Calling it a runtime feature, or confusing it with Server Components.
- Saying "you never need `useMemo` again". Effect dependencies and precise control still need it.
- Turning it on without first running the lint rules, then blaming the compiler for bugs caused by mutating props.

## Tips
- Lead with "build-time automatic memoization that relies on the Rules of React". Then cover requirements, opt-out and rollout. This structure covers what interviewers check.
- Mention the DevTools "Memo ✨" badge as your way of verifying it. Practical details like this stand out.
