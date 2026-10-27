---
title: "How does next/image optimise images, and what must you configure in Next.js 16?"
level: medium
type: concept
tags: [next-image, image-optimization, sizes, remotePatterns, qualities, cls]
related: [nextjs/lcp-image-fix, performance/images-and-fonts-loading, nextjs/code-splitting-lazy]
---

## Question
What does `next/image` do for you? Explain `width`/`height` vs `fill`, `sizes`, lazy loading, remote image configuration, and the defaults that changed in Next.js 16.

## Interview Answer
`next/image` serves resized, modern-format images (WebP, optionally AVIF) on demand through Next.js' image optimiser, lazy-loads below-the-fold images by default, and reserves space using `width`/`height` or `fill` so there's no layout shift. For a responsive layout I give `sizes` so the browser picks the right candidate from the generated `srcset`, otherwise it assumes the image is as wide as the viewport and downloads too much. Remote images must be allowed in `images.remotePatterns` to prevent abuse of the optimiser. Next.js 16 tightened several defaults: `qualities` must be allow-listed (default is 75 only), `minimumCacheTTL` is 4 hours, local images with query strings need `localPatterns`, `images.domains` is deprecated in favour of `remotePatterns`, `16` was dropped from default `imageSizes`, and `priority` is deprecated in favour of `preload`.

## Explanation
### Basic usage

```tsx
import Image from "next/image";
import hero from "./hero.jpg";

<Image src={hero} alt="Team at work" placeholder="blur" />             {/* static import: size known, blur placeholder auto */}
<Image src="/logo.png" alt="Logo" width={120} height={40} />            {/* public/ image: explicit size */}
<Image src="https://cdn.example.com/p/1.jpg" alt="" width={400} height={300} />   {/* remote: must be allowed */}
```

Always write meaningful `alt` text, or `alt=""` for decorative images.

### `fill` and `sizes`

```tsx
<div className="relative aspect-video w-full">
  <Image
    src={post.cover}
    alt={post.title}
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    className="object-cover"
  />
</div>
```

- `fill` makes the image absolutely fill a positioned parent; give the parent dimensions (or an aspect ratio).
- `sizes` tells the browser how wide the image will render; with it, Next.js generates a full `srcset` (640w, 750w …); without it, a `fill` image behaves as if full-viewport.
- Use `sizes` whenever the image isn't full width.

### Loading behaviour
- Lazy by default (`loading="lazy"`); above-the-fold hero images should be loaded eagerly (see the LCP question).
- `placeholder="blur"` with `blurDataURL` (automatic for static imports) avoids empty boxes.
- `unoptimized` bypasses the optimiser (SVGs, authenticated sources, CDN doing it already).

### Configuration

```ts
// next.config.ts
const config = {
  images: {
    remotePatterns: [new URL("https://cdn.example.com/account123/**")],
    qualities: [60, 75],                 // required allow-list; default [75]
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 14400,              // 4 hours is the default in 16
    localPatterns: [{ pathname: "/assets/**", search: "?v=*" }],   // needed for query strings on local images
  },
};
```

### Next.js 16 image changes

| Change | Effect |
|---|---|
| `priority` deprecated | use `preload` (or `loading="eager"` / `fetchPriority="high"`) |
| `qualities` must be allow-listed | a `quality` outside the list is coerced to the nearest allowed value |
| `minimumCacheTTL` default 4 h (was 60 s) | fewer revalidations |
| `imageSizes` default drops `16` | smaller `srcset` |
| Local images with query strings | require `localPatterns.search` |
| Local IP restriction | optimiser blocks private IP sources by default |
| `maximumRedirects` default 3 | limits redirect following for remote images |
| `images.domains`, `next/legacy/image` deprecated | use `remotePatterns`, `next/image` |

### Cost and hosting
Optimised images are generated on demand and cached; on Vercel this is billed per transformation. Self-hosting uses Sharp (installed automatically in recent versions). A custom loader (`loaderFile`) lets you delegate to Cloudinary/imgix.

### Pitfalls
- Missing `sizes` on responsive images → oversize downloads.
- Wrong or missing dimensions → CLS.
- Remote host not allowed → 400 from the optimiser.
- Using `<img>` for large content images without optimisation (ESLint warns).

## Follow-ups
- **Why does `next/image` need width and height?** — To compute the aspect ratio and reserve space before the image loads.
- **Static import vs string path?** — Static imports give intrinsic dimensions and blur data at build time.

## Common Mistakes
- Forgetting `sizes` with `fill`.
- Using `priority` in new Next 16 code.
- Hosting user-uploaded images from unconfigured domains.

## Tips
- Mention `sizes` and CLS in the same breath; they're the parts people forget.
