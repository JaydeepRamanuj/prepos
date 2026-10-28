---
title: "How does next/font work, and how does it prevent layout shift?"
level: medium
type: concept
tags: [next-font, fonts, cls, font-display, self-hosting, variable-fonts]
related: [nextjs/lcp-image-fix, performance/images-and-fonts-loading, html-css/css-units-and-clamp]
---

## Question
What does `next/font` do at build time, why does it help CLS and privacy, how do you use Google and local fonts, and what are the trade-offs versus a plain `<link>` to Google Fonts?

## Interview Answer
`next/font` downloads Google fonts (or loads local files) at build time and self-hosts them with your static assets, so the browser makes no request to Google, which improves privacy and removes a cross-origin connection. It generates the `@font-face` rules, automatically preloads the font files used by a route, and applies a size-adjusted fallback font (using `size-adjust`, `ascent-override` and related descriptors) so the fallback text occupies the same space as the web font, which prevents layout shift when the swap happens. Fonts are scoped via a generated class name or CSS variable. I prefer variable fonts so I don't have to list weights, set `display: "swap"`, restrict `subsets`, and use only the weights I need. Compared with a Google Fonts `<link>`, it's faster and more private; the cost is that the font files are part of my build and cache lifecycle.

## Explanation
### Google fonts

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",          // expose as a CSS variable (useful with Tailwind)
});

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

For non-variable fonts, specify `weight` (and `style`). Variable fonts need no weight list and ship a single file for all weights.

### Local fonts

```tsx
import localFont from "next/font/local";

const brand = localFont({
  src: [
    { path: "./fonts/Brand-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Brand-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-brand",
  display: "swap",
});
```

### How it prevents layout shift
1. Without optimisation: text renders in a fallback font, then swaps to the web font with different metrics, so lines reflow (CLS).
2. `next/font` computes metric overrides so the fallback font's glyph widths and line height match the web font. When the swap happens, nothing moves.
3. It preloads the font files (for the subsets and routes using them) so the swap happens early.

### `font-display`

| Value | Behaviour |
|---|---|
| `swap` | show fallback immediately, swap when loaded (recommended for body text) |
| `optional` | use the web font only if it loads very quickly; no swap shift |
| `block` | invisible text for a short period (FOIT); avoid |
| `fallback` | brief invisible period then fallback, swap within a limited window |

### Practical guidance
- Load fonts in the root layout (or the layout of a section) so they're shared and preloaded once.
- Limit the number of families and weights; each file adds bytes on the critical path.
- Subsets: `latin` for most; add `latin-ext` only if needed (`preload: false` for rarely used subsets).
- Use CSS variables with Tailwind: `fontFamily: { sans: ["var(--font-inter)"] }` (Tailwind v4: `@theme { --font-sans: var(--font-inter) }`).
- Icon fonts: prefer inline SVG.
- Self-hosting means fonts are cached with the app's cache headers; hashed filenames allow `immutable`.
- Alternatives outside Next.js: `@fontsource` packages (self-hosted via npm), which this very project uses, but they don't provide the automatic metric-adjusted fallback.

### Pitfalls
- Importing the same font in many components creates multiple instances; define it once in a module and import the object.
- Using many weights from a non-variable font.
- Forgetting `subsets`, which makes Next.js warn.
- Expecting `next/font` to work in Pages `_document` without the correct pattern (use `_app` or layout).

## Follow-ups
- **Does it send requests to Google at runtime?** — No, only at build time.
- **How do I apply a font to one component?** — Use `font.className` or the CSS variable on that element.

## Common Mistakes
- Using a `<link>` to Google Fonts in addition to `next/font`.
- Preloading too many font files.
- Choosing `block` display.

## Tips
- Explain the fallback metric adjustment; it's the part most candidates can't.
