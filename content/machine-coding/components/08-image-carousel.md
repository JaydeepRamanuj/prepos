---
title: "Build an image carousel with autoplay, pause on hover and swipe support"
level: hard
type: implement
tags: [carousel, timers, useEffect, pointer-events, accessibility]
related: [machine-coding/countdown-stopwatch, machine-coding/progress-stepper]
---

## Question
Build an `ImageCarousel`.

**Must-haves**
- Takes `images: { src, alt }[]`. Shows one image at a time with Previous/Next buttons that wrap around.
- Dot indicators; clicking a dot jumps to that slide.
- Autoplay every 3 seconds; pauses while the mouse is over the carousel or focus is inside it.
- Left/Right arrow keys change slides when the carousel is focused.

**Stretch goals**
- Swipe left/right on touch devices.
- Sliding animation (not just swapping the image).
- A visible Pause/Play button and respect for `prefers-reduced-motion`.
- Lazy-load images that are not near the current slide.

## Clues
- The only essential state is `index`. Wrap with modulo: `(i + 1) % n` and `(i - 1 + n) % n` — the `+ n` stops negative results.
- Put autoplay in a `useEffect` whose dependencies include `index` and `paused`. Using `setTimeout` keyed on `index` means any manual navigation automatically restarts the 3-second countdown.
- For swipe, record `clientX` on `pointerdown` and compare on `pointerup`; only treat it as a swipe beyond a threshold like 50px.

## Interview Answer
I would ask how many images, whether autoplay is required to pause, and whether the transition must animate. State is `index` plus a `paused` flag derived from hover, focus and an explicit pause button. Navigation is a single `goTo(i)` that wraps with modulo, and Previous/Next/dots/keys/swipe all call it. Autoplay is a `setTimeout` inside an effect that depends on `index` and `paused`: when the timer fires it advances the index, which re-runs the effect and schedules the next one, and any manual navigation also resets the countdown for free. The slide animation is a flex track translated by `-index * 100%` with a CSS transition, disabled under `prefers-reduced-motion`. For accessibility I follow the APG carousel pattern: a labelled region with `aria-roledescription="carousel"`, each slide labelled "2 of 5", a real pause button, and a polite live region only when autoplay is off so screen readers aren't spammed.

## Explanation
### Component tree and state
```txt
ImageCarousel
  state: index, hovering, focused, userPaused
  derived: paused = hovering || focused || userPaused || reducedMotion
  ├─ viewport (overflow hidden, pointer handlers)
  │    └─ track (translateX(-index * 100%))
  │         └─ slide × n  (img, aria-label "i of n")
  ├─ Prev / Next buttons
  ├─ Pause/Play button
  └─ dots (buttons, aria-current on active)
```

### Why `setTimeout` keyed on `index`, not `setInterval`
With `setInterval`, clicking Next at 2.9s would be followed by an automatic advance 0.1s later — jarring. With a timeout that re-schedules whenever `index` changes, every navigation gives the user a full 3 seconds. It also avoids the stale-closure problem: there is no long-lived callback that captured an old `index`.

### Complete code

```tsx
// ImageCarousel.tsx
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

type Img = { src: string; alt: string };
type Props = { images: Img[]; interval?: number };

const SWIPE_THRESHOLD = 50;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function ImageCarousel({ images, interval = 3000 }: Props) {
  const n = images.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const pointerStartX = useRef<number | null>(null);

  const paused = hovering || focused || userPaused || reducedMotion;

  const goTo = (i: number) => setIndex(((i % n) + n) % n); // safe wrap for any integer
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // Autoplay: re-scheduled after every index change, cancelled while paused
  useEffect(() => {
    if (paused || n < 2) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % n), interval);
    return () => clearTimeout(id);
  }, [index, paused, n, interval]);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else return;
    e.preventDefault();
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    pointerStartX.current = e.clientX;
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (dx > SWIPE_THRESHOLD) prev();
    else if (dx < -SWIPE_THRESHOLD) next();
  }

  if (n === 0) return <p>No images</p>;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Product photos"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // only "blur" when focus leaves the whole carousel
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      style={{ maxWidth: 600, position: "relative" }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pointerStartX.current = null)}
        style={{ overflow: "hidden", touchAction: "pan-y" /* allow vertical page scroll */ }}
      >
        <div
          aria-live={paused ? "polite" : "off"}
          style={{
            display: "flex",
            transform: `translateX(-${index * 100}%)`,
            transition: reducedMotion ? "none" : "transform 400ms ease",
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}`}
              aria-hidden={i !== index}
              style={{ flex: "0 0 100%" }}
            >
              <img
                src={img.src}
                alt={img.alt}
                draggable={false}
                loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <button type="button" onClick={prev} aria-label="Previous slide">‹</button>
        <button type="button" onClick={() => setUserPaused((p) => !p)}>
          {userPaused ? "Play" : "Pause"}
        </button>
        <button type="button" onClick={next} aria-label="Next slide">›</button>
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => goTo(i)}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              border: 0,
              background: i === index ? "#111" : "#bbb",
            }}
          />
        ))}
      </div>
    </section>
  );
}
```

```tsx
// App.tsx
import { ImageCarousel } from "./ImageCarousel";

const images = [1, 2, 3, 4, 5].map((i) => ({
  src: `https://picsum.photos/id/${i * 10}/800/450`,
  alt: `Sample photo ${i}`,
}));

export default function App() {
  return <ImageCarousel images={images} />;
}
```

### Details that separate good from average
- **`((i % n) + n) % n`** — JavaScript `%` keeps the sign of the dividend (`-1 % 5 === -1`), so the extra `+ n` is required for Previous from slide 0.
- **Functional update inside the timer** (`setIndex(i => …)`) — correct even if the timeout outlives a render.
- **`onBlur` with `relatedTarget`** — focus moving between buttons inside the carousel fires blur/focus pairs; checking `contains` avoids flicker in the paused state.
- **`touch-action: pan-y`** — lets the page scroll vertically while you handle horizontal swipes; `draggable={false}` stops the browser's native image drag from eating pointer events.
- **`aria-hidden` on off-screen slides** — screen readers don't read five alt texts at once.
- **Live region only when paused** — announcing every auto-advance would be noise.

### Edge cases
- 0 images → empty state; 1 image → no autoplay (`n < 2`), you might hide controls.
- `images` prop shrinks below `index` → clamp: `const safe = Math.min(index, n - 1)`.
- Background tab: browsers throttle timers in hidden tabs, so autoplay naturally slows; for strictness, pause on `document.visibilitychange`.

### Stretch: infinite loop animation
With a plain translate track, going from the last slide to the first animates backwards across all slides. Production carousels clone the first and last slides at both ends, jump without a transition when you land on a clone, and continue. Mention it; build it only if time allows.

## Follow-ups
- **How would you build it with CSS scroll snap instead?** — A horizontally scrollable container with `scroll-snap-type: x mandatory`; swipe and momentum are native. You sync `index` by observing which slide is visible with `IntersectionObserver`, and navigate with `scrollIntoView`/`scrollTo`.
- **How would you show 3 slides at a time?** — Each slide becomes `flex: 0 0 33.333%` and the translate becomes `index * (100 / perView)%`, with `maxIndex = n - perView`.
- **How would you test autoplay?** — Fake timers: render, `vi.advanceTimersByTime(3000)`, assert the second slide is current; hover with `user.hover` and assert it does not advance.

## Common Mistakes
- `setInterval` with `setIndex(index + 1)` — stale closure, stuck on slide 1.
- Forgetting to clear the timer on unmount or when pausing.
- `(index - 1) % n` for previous, which produces `-1` on the first slide.
- Using `mouseover`/`mouseout` (which bubble from children) instead of `mouseenter`/`mouseleave`.

## Tips
- Build in layers: index + buttons (5 min) → dots → autoplay → pause → keyboard → swipe. Ship something working at every step; machine-coding rounds reward incremental progress.
- Say "one `goTo` function, every input calls it" — it shows you design for change.
