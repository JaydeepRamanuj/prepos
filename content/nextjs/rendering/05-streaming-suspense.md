---
title: "How does streaming work in Next.js: loading.tsx, Suspense and the static shell?"
level: hard
type: concept
tags: [streaming, suspense, loading-tsx, ttfb, partial-prerendering]
related: [react/suspense-streaming, nextjs/loading-error-not-found, nextjs/app-shell-partial-prerendering, nextjs/slow-ttfb-dynamic-page]
---

## Question
How does Next.js stream a page? What is the difference between `loading.tsx` and a manual `<Suspense>`, how does placement affect UX and SEO, and what changes with Cache Components?

## Clues
- Streaming means sending HTML in chunks over one response.
- `loading.tsx` wraps the page in a Suspense boundary automatically.
- Parts that depend on runtime data must be isolated so they don't block the rest.

## Interview Answer
Next.js uses React's streaming server rendering: the server sends the static parts and Suspense fallbacks immediately, then streams in each suspended section's HTML as its data resolves, together with the RSC payload, so the user sees content progressively and time to first byte isn't gated by the slowest query. `loading.tsx` is a convenience: it wraps the segment's `page.tsx` in a `<Suspense>` with that fallback, and it shows instantly on navigation, while manual `<Suspense>` boundaries give finer control over which sections stream. Placement matters: a boundary around the whole page is all-or-nothing, while several smaller ones reveal sections independently. With Cache Components, anything that can finish during prerender, including `"use cache"` results, goes into the static shell, and the Suspense fallbacks for runtime or uncached parts are part of that shell, so the shell can come from a CDN and the dynamic holes stream. Streamed content is still in the HTML response, so it's crawlable, but once streaming begins the status code is already sent.

## Explanation
### `loading.tsx`

```txt
app/dashboard/
  layout.tsx
  loading.tsx   ->  <Suspense fallback={<Loading />}> <page /> </Suspense>
  page.tsx
```

The layout isn't wrapped, so navigation chrome renders immediately. Because layouts persist, only the page area shows the skeleton.

### Granular boundaries

```tsx
export default function Page() {
  return (
    <>
      <Header />                                         {/* static */}
      <Suspense fallback={<StatsSkeleton />}><Stats /></Suspense>
      <Suspense fallback={<FeedSkeleton />}><Feed /></Suspense>
    </>
  );
}
```

Each async child streams when ready. Start independent fetches in parallel (they begin when their component renders, and sibling boundaries render concurrently), and avoid awaiting everything at the top of the page.

### What the response looks like

```txt
chunk 1: <html>…shell… <div id="B:0">Loading stats…</div> <div id="B:1">Loading feed…</div>
chunk 2: <template id="S:0">…stats HTML…</template><script>swap B:0 with S:0</script>
chunk 3: <template id="S:1">…feed HTML…</template><script>swap B:1 with S:1</script>
```

### Cache Components twist
- Static content and cached components are in the prerendered shell; fallbacks for dynamic holes are in it too.
- Uncached fetches and runtime APIs (`cookies()`, `headers()`, `searchParams`, unresolved `params`) must be inside Suspense or Next.js raises a blocking-route error during validation.
- Moving `await params` or `await cookies()` deeper in the tree makes the shell bigger.

### SEO and status codes
- Crawlers receive the streamed HTML eventually; Googlebot handles it.
- The HTTP status is sent with the first chunk. Calling `notFound()` after streaming has started can't change a 200 to 404 (Next.js adds a `noindex` meta tag in that case), so check existence before the first flush, usually in the page or layout outside Suspense, if a real 404 matters.
- Metadata can stream too, but should be available early for bots.

### UX guidelines
1. Fallbacks should match the final layout size to avoid CLS.
2. Group things that should appear together; too many spinners feel janky.
3. Avoid fallback flashes on fast data: use `useTransition` for client updates or cache.
4. Pair with error boundaries (`error.tsx`) so a failing section degrades alone.

### Debugging slow pages
If TTFB is slow, something above the first `Suspense` is awaiting data. Move that data fetching down or into its own boundary.

## Follow-ups
- **Does streaming need special hosting?** — Yes, the platform must not buffer responses; Node servers and Vercel stream by default, some proxies/CDNs buffer.
- **Is `loading.tsx` enough?** — It's the coarse version; use manual boundaries for finer control.

## Common Mistakes
- Awaiting data in the layout above all Suspense boundaries.
- One boundary around everything.
- Using `notFound()` inside a streamed section expecting a 404 status.

## Tips
- Explain what the user sees at each chunk; it demonstrates real understanding.
