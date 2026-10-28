---
title: "How do document metadata and resource preloading APIs work in React 19?"
level: medium
type: concept
tags: [metadata, title, preload, preconnect, react-dom, head]
related: [react/react-18-to-19-changes, nextjs/metadata-seo, performance/loading-resource-hints]
---

## Question
React 19 lets components render `<title>`, `<meta>` and `<link>` directly. How does that work, and what are the `react-dom` resource APIs like `preload`, `preinit` and `preconnect` for? How does this relate to Next.js metadata?

## Interview Answer
In React 19, if a component renders `<title>`, `<meta>` or `<link rel="stylesheet">`, React hoists them into the document `<head>` automatically, in both client and streaming server rendering, so any component can declare the metadata for its page without libraries like `react-helmet`. Stylesheets with a `precedence` prop are deduplicated and inserted in order, and Suspense waits for them to load before revealing content to avoid unstyled flashes. The `react-dom` functions `preconnect`, `prefetchDNS`, `preload` and `preinit` let components hint the browser early about origins, fonts, scripts and styles. In Next.js, I still use the `metadata` export or `generateMetadata`, which handle merging and streaming at framework level; React's native tags are lower-level.

## Explanation
### Metadata in components

```tsx
function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      <title>{post.title}</title>
      <meta name="description" content={post.summary} />
      <link rel="canonical" href={`https://example.com/blog/${post.slug}`} />
      <h1>{post.title}</h1>
    </article>
  );
}
```

React places the tags in `<head>`. If multiple components render a `<title>`, the last rendered wins on the client.

### Stylesheets with precedence

```tsx
<link rel="stylesheet" href="/theme.css" precedence="default" />
```

- Same `href` rendered by several components is loaded once.
- `precedence` controls ordering relative to other sheets.
- When rendered inside Suspense, the boundary waits until the stylesheet has loaded.

### Async scripts
`<script async src="…" />` is deduplicated by `src` wherever it's rendered.

### Resource hint functions

```tsx
import { preconnect, prefetchDNS, preload, preinit } from "react-dom";

function Checkout() {
  preconnect("https://api.payments.example");         // open connection early
  prefetchDNS("https://analytics.example");
  preload("/fonts/inter.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preinit("/vendor/widget.js", { as: "script" });      // fetch and execute
  return <Form />;
}
```

They can be called during render or in event handlers; React dedupes and emits the right `<link>` tags/headers (early in streaming, hints may become `Link` headers or `<link>` in the shell).

### When to use which

| API | Effect |
|---|---|
| `prefetchDNS(url)` | resolve DNS only |
| `preconnect(url)` | DNS + TCP + TLS |
| `preload(url, opts)` | fetch a resource that will be needed soon, don't execute |
| `preinit(url, opts)` | fetch and evaluate script/style now |

### Next.js relationship
Next.js App Router has its own Metadata API (`export const metadata`, `generateMetadata`) that merges across layouts, supports Open Graph, JSON-LD patterns and streams metadata. Use it for page metadata; the React tags are mainly for libraries and non-framework setups. `next/font`, `next/image` and `next/script` apply resource hints for you.

### Caveats
- Only render one `<title>` per page; conflicting tags are not merged smartly.
- `<meta>` tags with the same `name` aren't deduplicated automatically.
- Client-only SPAs: metadata updates happen after JS runs, so crawlers that don't execute JS miss it; SSR/SSG still recommended for SEO.
- `<title>` inside SVG is left alone.

## Follow-ups
- **How is this different from `react-helmet`?** — Built into React, SSR/streaming aware, no extra provider.
- **Can I set metadata from a Client Component in Next.js?** — The Metadata API works in Server Components; native tags can appear in client components too, but prefer the Metadata API.

## Common Mistakes
- Rendering multiple titles.
- Preloading everything, which wastes bandwidth.
- Forgetting `crossOrigin` for font preloads.

## Tips
- Mention `precedence` and Suspense waiting for stylesheets; it's a lesser-known detail.
