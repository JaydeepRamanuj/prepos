---
title: "Product pages aren't indexed: content is rendered client-side. How do you fix it?"
level: medium
type: scenario
tags: [seo, ssr, client-rendering, metadata, structured-data, crawling, status-codes]
related: [nextjs/metadata-seo, nextjs/structured-data-sitemap-robots, nextjs/server-vs-client-components, nextjs/streaming-suspense]
---

## Question
Search Console shows many product URLs as "Discovered – currently not indexed" and snippets show only the loading spinner text. The page is a `"use client"` component that fetches the product in `useEffect`. Describe the root problem and the changes you would make, including metadata, status codes and structured data.

## Interview Answer
Crawlers fetch the HTML and may render JavaScript later or not at all, so a page whose meaningful content only appears after client-side fetching has an almost empty initial HTML: just the shell and a spinner. The fix is to render the product on the server: make the page a Server Component that fetches the data (cached with tags), so the HTML contains the title, price and description. Add proper metadata via `generateMetadata` (title, description, canonical, Open Graph), JSON-LD `Product` structured data, a sitemap listing the URLs, and correct status codes: unknown products should return 404 via `notFound()` before streaming starts. Interactivity like add-to-cart stays in small Client Components. Then verify with "View Source", the URL Inspection tool, and Search Console coverage, and watch Core Web Vitals because server rendering usually improves LCP too.

## Explanation
### Before

```tsx
"use client";
export default function ProductPage({ params }) {
  const [p, setP] = useState(null);
  useEffect(() => { fetch(`/api/products/${params.id}`).then((r) => r.json()).then(setP); }, [params.id]);
  if (!p) return <Spinner />;
  return <ProductView p={p} />;
}
```

Initial HTML: no product text, no title, no structured data; also a data waterfall (HTML → JS → fetch → render) that hurts LCP.

### After

```tsx
// app/products/[id]/page.tsx — Server Component
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return {};
  return {
    title: p.name,
    description: p.summary,
    alternates: { canonical: `/products/${id}` },
    openGraph: { title: p.name, images: [p.image] },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProduct(id);          // "use cache" + cacheTag(`product-${id}`)
  if (!p) notFound();                      // real 404 status when decided before streaming

  return (
    <article>
      <JsonLd data={productSchema(p)} />   {/* Product, Offer, AggregateRating */}
      <h1>{p.name}</h1>
      <p>{p.description}</p>
      <Price value={p.price} />
      <AddToCartButton id={p.id} />        {/* "use client" interactive leaf */}
    </article>
  );
}
```

### Checklist

| Area | Action |
|---|---|
| Rendering | server-render critical content (title, price, description, images, links) |
| Metadata | unique title/description; canonical; OG tags |
| Status codes | `notFound()` for missing items, redirects for moved ones; verify the HTTP status |
| Internal links | real `<a>` via `<Link>` so crawlers discover pages; avoid JS-only navigation |
| Sitemap | `app/sitemap.ts` with all indexable URLs and `lastModified` |
| Structured data | JSON-LD `Product`, `BreadcrumbList` |
| robots | allow product pages; don't block assets (CSS/JS) |
| Performance | LCP image preload, caching, fonts |
| Pagination/filters | canonical to the main listing; avoid infinite scroll without crawlable pages |
| Duplicate content | canonical URLs for parameter variants |

### Streaming caveat
If product data loads inside a Suspense boundary after the shell has been sent, the status code is already 200; to return a real 404, check existence before the first flush (outside Suspense), keeping the heavy sections streamed. Bots receive blocking `<head>` metadata thanks to HTML-limited bot detection.

### Verifying

1. `curl -s URL | grep -i "<h1"`: the product name is in the HTML.
2. Google Search Console URL Inspection → "View crawled page" / "Live test".
3. Rich Results Test for JSON-LD.
4. Lighthouse SEO audit and Core Web Vitals (CrUX).
5. Crawl with Screaming Frog or similar with JS rendering off.

### Rendering strategies recap
Static generation or cached server rendering for product pages (with tag revalidation on price/stock changes); client-side fetching only for truly personal or live bits (stock level polling, recommendations).

### Not a magic bullet
Content quality, internal linking, crawl budget and page speed affect indexing too; "Discovered – not indexed" can reflect low perceived value or crawl budget. Fix rendering first, then improve these.

## Follow-ups
- **Does Google execute JavaScript?** — It does render JS, with delays and limits; other crawlers and social previews often don't, and relying on it is risky.
- **Where do social previews get their data?** — From the initial HTML's OG tags, so they must be server-rendered.

## Common Mistakes
- Setting metadata in a client effect (`document.title`).
- Returning 200 with a "not found" message (soft 404).
- Blocking JS/CSS in robots.txt.

## Tips
- Use "View Source" as your first diagnostic; it's the crawler's first view.
