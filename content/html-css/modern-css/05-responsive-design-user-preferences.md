---
title: "Responsive design in practice: mobile-first, breakpoints and user preference media features"
level: medium
type: design
tags: [responsive-design, mobile-first, media-queries, prefers-color-scheme, prefers-reduced-motion, color-scheme]
related: [html-css/css-units-and-clamp, html-css/container-queries-has, html-css/tailwind-v4-css-first]
---

## Question
How do you approach responsive design for a new feature? Cover mobile-first CSS, choosing breakpoints, responsive images, touch targets, and user-preference media queries such as dark mode and reduced motion.

## Interview Answer
I design mobile-first: write the base styles for the smallest screens, then add `min-width` media queries (or container queries for components) only where the content breaks, rather than targeting specific devices. Layouts use fluid techniques (grid `auto-fit`, `clamp()`, `max-width` in `ch`/`rem`) so fewer breakpoints are needed; breakpoints are in `rem`/`em` so they respect user font settings. Images use `srcset` and `sizes` (or `next/image`) plus `<picture>` for art direction, and `aspect-ratio` to prevent layout shift. I make touch targets at least 24×24 CSS px (aim for 44×44), avoid hover-only interactions (`@media (hover: hover)`), and support user preferences: `prefers-color-scheme` with the `color-scheme` property for dark mode, `prefers-reduced-motion` to tone down animations, `prefers-contrast` and `forced-colors` for high-contrast needs. I test on real devices, with zoom and with different font sizes.

## Explanation
### Mobile-first CSS

```css
.layout { display: grid; gap: 1rem; }                       /* 1 column by default */

@media (min-width: 48rem) {                                 /* ~768px */
  .layout { grid-template-columns: 16rem 1fr; }
}
@media (min-width: 80rem) {
  .layout { max-width: 80rem; margin-inline: auto; }
}
```

Base styles are simpler and faster on low-powered devices; `max-width` queries produce override-heavy CSS.

### Choosing breakpoints
- Let content decide: resize until the design breaks, add a query there.
- Keep a small set (e.g. 40rem, 48rem, 64rem, 80rem); Tailwind's defaults are `sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`, `2xl 96rem`.
- Component-level changes → container queries; page-level changes → media queries.
- Test between breakpoints and at extreme widths (320px, ultrawide).

### Images

```html
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
  sizes="(min-width: 64rem) 50vw, 100vw"
  width="1600" height="900" alt="…" loading="lazy" decoding="async" />

<picture>
  <source media="(min-width: 48rem)" srcset="hero-wide.avif" type="image/avif">
  <img src="hero-narrow.jpg" alt="…" width="800" height="1000">
</picture>
```

```css
img { max-width: 100%; height: auto; }
.thumb { aspect-ratio: 16 / 9; object-fit: cover; }
```

### Touch and input

```css
.btn { min-block-size: 44px; min-inline-size: 44px; }       /* comfortable target */

@media (hover: hover) and (pointer: fine) {
  .card:hover { box-shadow: var(--shadow-lg); }             /* hover effects only where hover exists */
}
```

WCAG 2.2 requires targets at least 24×24 CSS px (with spacing exceptions); 44×44 is the Apple/WCAG AAA guidance. Inputs should use ≥16px font size to avoid iOS zoom on focus.

### User preferences

```css
:root { color-scheme: light dark; }                         /* native controls/scrollbars follow the theme */

@media (prefers-color-scheme: dark) {
  :root { --bg: #0e1424; --fg: #e5e8f1; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@media (prefers-contrast: more) { :root { --border: #000; } }
@media (forced-colors: active) { .btn { border: 1px solid ButtonText; } }
```

- For an in-app theme toggle, store the choice (cookie/localStorage) and set `data-theme`/`.dark` on `<html>` before first paint to avoid a flash; keep `color-scheme` in sync. (This site uses a `.dark` class with `@custom-variant dark`.)
- `light-dark()` function: `color: light-dark(#111, #eee)` resolves by `color-scheme`.
- `prefers-reduced-data`, `prefers-reduced-transparency` exist with partial support.

### Testing checklist
1. Chrome DevTools device mode and real phones (iOS Safari, Android Chrome).
2. 200% zoom and increased default font size.
3. Landscape orientation and foldables.
4. Keyboard on mobile (viewport resize); `dvh` and safe areas (`env(safe-area-inset-*)`).
5. Slow network: image weights, layout shift.
6. Reduced motion and dark mode toggles in DevTools "Rendering" tab.

### Anti-patterns
- Device-specific breakpoints (iPhone widths).
- Disabling zoom (`user-scalable=no`, `maximum-scale=1`) — an accessibility failure.
- Hiding essential content on mobile.
- Fixed pixel widths on containers.
- Hover-only menus.

## Follow-ups
- **`viewport` meta tag?** — `<meta name="viewport" content="width=device-width, initial-scale=1">` is required for responsive layouts on mobile.
- **min-width vs max-width queries?** — Mobile-first uses `min-width`.

## Common Mistakes
- Desktop-first CSS that needs many overrides.
- Ignoring reduced motion and contrast preferences.
- Forgetting width/height attributes on images.

## Tips
- Mention content-driven breakpoints and user preference queries.
