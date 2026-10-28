---
title: "How do you handle metadata and SEO with the Metadata API?"
level: medium
type: concept
tags: [metadata, seo, generateMetadata, opengraph, canonical, sitemap, robots]
related: [nextjs/structured-data-sitemap-robots, react/document-metadata-preloading, nextjs/streaming-suspense]
---

## Question
How do you set titles, descriptions, Open Graph tags and canonical URLs in the App Router? Explain static `metadata` vs `generateMetadata`, merging across layouts, and how streaming affects metadata.

## Interview Answer
In the App Router, a layout or page exports a `metadata` object for static values or an async `generateMetadata` function when values depend on params or data. Next.js merges metadata from the root layout down to the page, with deeper segments overriding shallower ones, and supports a `title.template` like `%s | PrepOS`. I fill `description`, `alternates.canonical`, `openGraph`, `twitter` and `robots`, and use file conventions for `opengraph-image`, `icon`, `sitemap.ts` and `robots.ts`. Metadata functions run on the server; fetches inside `generateMetadata` are memoised with the page's own, so the same data isn't requested twice. Next.js streams metadata separately so it doesn't block rendering for real users, but for bots that need it in `<head>` it falls back to serving it blocking, based on the `htmlLimitedBots` list. Async `params` and `searchParams` are Promises in `generateMetadata` too.

## Explanation
### Static and dynamic

```tsx
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://prepos.dev"),
  title: { default: "PrepOS", template: "%s | PrepOS" },
  description: "Frontend interview prep",
  openGraph: { siteName: "PrepOS", type: "website" },
};
```

```tsx
// app/tracks/[track]/[slug]/page.tsx
export async function generateMetadata(
  { params }: { params: Promise<{ track: string; slug: string }> }
): Promise<Metadata> {
  const { track, slug } = await params;
  const q = await getQuestion(track, slug);                // memoised with the page's own call
  if (!q) return {};
  return {
    title: q.title,                                        // "…| PrepOS" via template
    description: q.summary,
    alternates: { canonical: `/tracks/${track}/${slug}` },
    openGraph: { title: q.title, description: q.summary, type: "article" },
  };
}
```

`metadataBase` lets you use relative URLs for canonical and OG images.

### Merging rules
- Fields are shallow-merged by key from root to leaf; a child's `openGraph` replaces the parent's `openGraph` object entirely (it doesn't deep merge), so repeat shared fields if needed.
- `title.template` applies to child titles; `title.absolute` ignores it.
- Only `generateMetadata` or `metadata` per segment, not both.

### File conventions
- `opengraph-image.tsx` / `twitter-image.tsx` (static or generated with `ImageResponse`), `icon.tsx`, `apple-icon`.
- `sitemap.ts` (and `generateSitemaps` for large sites), `robots.ts`, `manifest.ts`.
- In Next.js 16 `params` (and `id`) passed to these image/sitemap functions are Promises.

### Data fetching and caching
- Metadata fetches are memoised with page fetches (fetch GET dedupe or `React.cache`).
- With Cache Components, `generateMetadata` that reads uncached or runtime data needs handling similar to pages; cache the data function or move runtime access behind boundaries as the docs describe.

### Streaming metadata
Next.js can stream metadata after the initial UI for browsers, appending to `<body>`, while serving blocking `<head>` metadata for bots in `htmlLimitedBots` (and you can customise that list). Status codes and redirects are decided before streaming starts.

### SEO checklist
1. Unique title and description per page.
2. Canonical URL, especially with filters/pagination.
3. Open Graph/Twitter images (1200×630).
4. `robots`: `noindex` for private or duplicate pages.
5. Sitemap and `robots.txt`.
6. Structured data (JSON-LD) for articles, products, breadcrumbs.
7. Semantic HTML, headings, internal links, fast Core Web Vitals.
8. Correct status codes (404 for missing pages; `notFound()` before streaming when status matters).
9. Server-render important content (not client-only).

## Follow-ups
- **Can Client Components export metadata?** — No; metadata is for Server Components. Use `document.title` or React 19's `<title>` for client-only updates.
- **How do you avoid double fetching in `generateMetadata`?** — Share a `cache()`-wrapped or `use cache` data function.

## Common Mistakes
- Forgetting `metadataBase` and getting localhost URLs in OG tags.
- Expecting `openGraph` to deep-merge.
- Using `next/head` in the App Router.

## Tips
- Mention memoisation and the bot/blocking behaviour for depth.
