---
title: "How do you use browser-only or third-party libraries without breaking SSR?"
level: medium
type: scenario
tags: [ssr, use-client, dynamic-import, window-is-not-defined, third-party]
related: [nextjs/server-client-composition-patterns, nextjs/code-splitting-lazy, nextjs/hydration-how-it-works]
---

## Question
Your build fails with `ReferenceError: window is not defined` after adding a charting library and a map widget. Another library throws "You're importing a component that needs useState". How do you fix each case, and what are the trade-offs?

## Interview Answer
There are two separate problems. "needs useState/hooks" means a library component uses client features but isn't marked `"use client"`, so I wrap it in my own file with the directive and import that wrapper from Server Components. `window is not defined` means code touches browser globals while rendering on the server, either at import time or in render. Fixes, in order of preference: move browser access into `useEffect` or event handlers; guard with a mounted state; or load the component only on the client with `next/dynamic` and `ssr: false` from a Client Component, accepting that it won't be in the server HTML and showing a fallback to reserve space. I keep these wrappers small and measure the bundle, because client-only libraries add JavaScript and delay content.

## Explanation
### Case 1: component needs client features

```tsx
// components/ui/carousel.tsx
"use client";
export * from "some-carousel-lib";        // now usable from Server Components
```

```tsx
// app/page.tsx (Server Component)
import { Carousel, Slide } from "@/components/ui/carousel";
```

### Case 2: `window` at render or import time

```tsx
// Bad
const width = window.innerWidth;           // runs on the server

// Better: effect
const [width, setWidth] = useState<number | null>(null);
useEffect(() => setWidth(window.innerWidth), []);
```

### Case 3: library breaks on import

```tsx
"use client";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/map-impl"), {
  ssr: false,                               // skip server rendering entirely
  loading: () => <div className="h-96 animate-pulse bg-sunken" />,   // reserve space (avoid CLS)
});

export function MapSection(props: MapProps) {
  return <Map {...props} />;
}
```

`ssr: false` is only allowed in Client Components (the `dynamic` import with it isn't allowed in Server Components).

### Alternative: React `lazy` + Suspense, or an import inside an effect

```tsx
useEffect(() => {
  import("chart.js/auto").then(({ default: Chart }) => init(Chart));
}, []);
```

### Trade-offs

| Technique | Pros | Cons |
|---|---|---|
| `"use client"` wrapper | simple, still SSR'd | library JS in the bundle |
| Effect-based access | SSR-safe | content appears after hydration |
| `dynamic(..., { ssr: false })` | avoids server errors, code-split | not in HTML, flash, needs placeholder |
| Server-side alternative (render SVG/Chart on server) | no client JS | not interactive |

### Other practical tips
- Check if the library has an SSR-safe or RSC build; many do.
- Guard globals: `typeof window !== "undefined"` in module scope is fine for avoiding crashes but don't use it in render to branch UI (hydration mismatch).
- Use `next.config` `transpilePackages` for ESM-only or untranspiled packages; `serverExternalPackages` for packages that must not be bundled on the server.
- Load heavy widgets below the fold lazily on interaction/visibility to protect LCP and INP.
- Analytics and third-party scripts: use `next/script` with `strategy="afterInteractive"` or `lazyOnload`, or `@next/third-parties`.

## Follow-ups
- **Why not make the whole page `"use client"`?** — It ships the full tree as JS and loses server data access.
- **Is `ssr: false` bad for SEO?** — Only if the content matters for search; decorative widgets are fine.

## Common Mistakes
- Branching on `typeof window` in render.
- Using `ssr: false` in a Server Component.
- No placeholder, causing layout shift.

## Tips
- Distinguish "needs client" from "needs browser" errors; they have different fixes.
