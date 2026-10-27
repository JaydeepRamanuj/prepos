---
title: "Smooth animations: compositor-only properties, will-change and the rendering pipeline"
level: medium
type: concept
tags: [animation, compositor, transform, opacity, will-change, requestAnimationFrame, jank]
related: [performance/layout-thrashing, html-css/stacking-contexts, html-css/responsive-design-user-preferences]
---

## Question
Why are some CSS animations smooth and others janky? Explain the browser rendering pipeline (style, layout, paint, composite), which properties are cheap to animate, how `will-change` and layers work, and how to animate with the Web Animations API or `requestAnimationFrame`.

## Interview Answer
Browsers render frames through style calculation, layout, paint and compositing; animating a property triggers the earliest stage it affects and everything after. Changing `width`, `top` or `margin` invalidates layout, so layout, paint and composite run every frame on the main thread, which is expensive. Changing `background-color` or `box-shadow` skips layout but repaints. Animating `transform` and `opacity` (and, in some browsers, `filter`) can run entirely on the compositor thread, on the GPU, without involving the main thread, so they stay smooth even when JavaScript is busy. I therefore animate with transforms (move with `translate`, resize with `scale`), avoid animating layout properties, use `will-change: transform` sparingly to hint layer promotion before an animation starts (and remove it after), and keep frames under 16.7 ms (60 fps) or 8.3 ms (120 Hz). For JavaScript-driven animation I use `requestAnimationFrame`, the Web Animations API (`element.animate`) or a library, and I respect `prefers-reduced-motion`.

## Explanation
### Pipeline cost by property

```txt
JS → Style → Layout → Paint → Composite
 width/height/top/left/margin/font-size:  Style + Layout + Paint + Composite   (expensive)
 color/background/box-shadow/border-radius: Style + Paint + Composite           (medium)
 transform/opacity (+ filter in some cases): Composite only (on compositor)      (cheap)
```

Resources like csstriggers.com list which stage each property triggers in each engine.

### Do this instead

```css
/* Janky: animates layout */
.panel { transition: left .3s; }
.panel.open { left: 0; }

/* Smooth: animates transform */
.panel { transform: translateX(-100%); transition: transform .3s ease-out; }
.panel.open { transform: translateX(0); }

/* Grow without layout: scale + counter-scale content if needed */
.card:hover { transform: scale(1.03); }

/* Fade */
.toast { opacity: 0; transition: opacity .2s; }
.toast.show { opacity: 1; }
```

Animating height to 0 (accordions) is common: alternatives are `grid-template-rows: 0fr → 1fr` transitions (animatable in modern browsers), `interpolate-size: allow-keywords` with `height: auto` (Chromium), or `<details>` animation using `::details-content` as it ships. Fall back to measuring and animating `max-height` or using transforms when performance matters.

### Layers and `will-change`
Elements animating `transform`/`opacity` are promoted to their own compositor layer. A layer has memory cost (texture size × pixel density) and can cause blurry text or stacking changes.

```css
.menu { will-change: transform; }        /* hint: prepare the layer */
```

Guidelines:
- Use `will-change` on the few elements about to animate; add before animation, remove after (or apply on hover for the next interaction).
- Don't put `will-change` on many elements or on huge ones; it wastes GPU memory and can slow things.
- `transform: translateZ(0)` hacks are outdated.
- Layers create stacking contexts (affecting z-index and fixed positioning).

### Measuring
- DevTools Performance → Frames, check main-thread work during animation; "Rendering → Paint flashing", "Layer borders", "Frame Rendering Stats".
- Layers panel to inspect compositing and memory.
- Look for long frames (>16.7 ms) and "Recalculate style/Layout" bars during animation.

### JavaScript-driven animation

```js
// Prefer WAAPI: runs on the compositor when animating transform/opacity
el.animate(
  [{ transform: "translateY(20px)", opacity: 0 }, { transform: "none", opacity: 1 }],
  { duration: 250, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }
);

// rAF loop for custom physics; read and write in the same frame, avoid layout reads
let x = 0;
function frame(t) {
  x += 2;
  el.style.transform = `translateX(${x}px)`;
  if (x < 300) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- Don't drive animation with `setInterval`/`setTimeout`; they aren't aligned with frames.
- Use the delta time (`t - last`) so speed is consistent across refresh rates.
- Avoid animating many elements with JS; use CSS or a single canvas/WebGL for particle-like effects.
- Scroll-linked animations: use CSS scroll-driven animations (`animation-timeline: scroll()`/`view()`) or `IntersectionObserver` instead of scroll listeners.
- View Transitions API for page/element transitions (browser-supported snapshots).

### Accessibility and UX
- Respect `prefers-reduced-motion`: replace large movements with fades or disable.
- Keep durations short (150–300 ms) for UI feedback; avoid flashing (WCAG: no more than three flashes per second).
- Don't animate focus outlines out of existence.

### React specifics
- Animate with CSS classes/transform; avoid re-rendering per frame (use refs or libraries like Framer Motion / Motion One, which animate outside React's render).
- Use `layout` animations (FLIP) rather than animating width/height directly.

## Follow-ups
- **What is FLIP?** — First, Last, Invert, Play: measure the start and end positions, then animate the inverse transform, converting layout changes into transforms.
- **Why can `opacity` animations still jank?** — If the element isn't promoted, or if the main thread is busy while the animation is main-thread driven (for example JS updating styles).

## Common Mistakes
- Animating `top/left/width/height`.
- Adding `will-change` everywhere.
- Using timers instead of rAF/WAAPI.

## Tips
- Memorise "transform and opacity are compositor-friendly".
