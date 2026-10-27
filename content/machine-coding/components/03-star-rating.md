---
title: "Build a Star Rating component with hover preview, half stars and keyboard support"
level: medium
type: implement
tags: [star-rating, hover-state, keyboard, aria, controlled-components]
related: [machine-coding/otp-input, machine-coding/tabs-component]
---

## Question
Build a `StarRating` component.

**Must-haves**
- Shows `max` stars (default 5). Clicking star *n* sets the rating to *n*.
- Hovering previews the rating (stars fill up to the hovered star); moving the mouse out restores the selected value.
- Works as a controlled component: `value` + `onChange`.
- Keyboard accessible: arrow keys change the value; screen readers announce "3 of 5 stars".

**Stretch goals**
- Half-star precision (`allowHalf`): hovering/clicking the left half of a star selects 2.5.
- Clicking the current value again clears the rating.
- A `readOnly` mode for displaying averages like 4.3.

```tsx
const [rating, setRating] = useState(0);
<StarRating value={rating} onChange={setRating} allowHalf />
```

## Interview Answer
I would clarify whether it is controlled or uncontrolled, whether half stars are needed, and whether the read-only display must show fractional values like 4.3. The state design has two values: the committed `value`, which the parent owns, and a local `hoverValue: number | null` for the preview — the displayed value is `hoverValue ?? value`, so mouse-out just sets hover back to `null`. Each star renders a fill percentage computed from the displayed value, which makes half stars and read-only fractions the same code path. For accessibility I model it as a slider: one focusable element with `role="slider"` and `aria-valuenow`/`aria-valuetext`, where arrow keys step by 1 or 0.5. Half-star detection compares the mouse X to the midpoint of the star's bounding box.

## Explanation
### State design
```txt
parent: value (committed)          StarRating: hoverValue (number | null)
                    display = hoverValue ?? value
star i (1-based) fill = clamp(display - (i - 1), 0, 1)   → 0, 0.5, 1, or 0.3
```

The single formula `fill = clamp(display - (i - 1), 0, 1)` is the trick worth memorising. For display 3.5: star 3 → 1, star 4 → 0.5, star 5 → 0. For read-only 4.3, star 5 → 0.3. No special casing anywhere.

### Why `role="slider"` and not five buttons?
Five radio buttons (`role="radiogroup"`) is also valid and is what many libraries do. A slider is simpler with half stars, because one control with `aria-valuenow=2.5` is easier to announce than ten radios. Pick one and explain why — both are defensible.

### Complete code

```tsx
// StarRating.tsx
import { useState, type KeyboardEvent, type MouseEvent } from "react";

type Props = {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  allowHalf?: boolean;
  readOnly?: boolean;
  label?: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function StarRating({ value, onChange, max = 5, allowHalf = false, readOnly = false, label = "Rating" }: Props) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const display = hoverValue ?? value;
  const step = allowHalf ? 0.5 : 1;

  // Which value does the pointer point at, for star index i (1-based)?
  function valueFromPointer(e: MouseEvent<HTMLSpanElement>, i: number) {
    if (!allowHalf) return i;
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - left < width / 2;
    return isLeftHalf ? i - 0.5 : i;
  }

  function commit(next: number) {
    if (readOnly) return;
    // clicking the current value clears it (stretch goal)
    onChange?.(next === value ? 0 : clamp(next, 0, max));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    const map: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      Home: 0,
      End: max,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    onChange?.(clamp(map[e.key], 0, max));
  }

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max} stars`}
      aria-readonly={readOnly || undefined}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHoverValue(null)}
      style={{ display: "inline-flex", gap: 2, cursor: readOnly ? "default" : "pointer" }}
    >
      {Array.from({ length: max }, (_, idx) => {
        const i = idx + 1;
        const fill = clamp(display - idx, 0, 1); // 0..1
        return (
          <span
            key={i}
            aria-hidden="true"
            onMouseMove={readOnly ? undefined : (e) => setHoverValue(valueFromPointer(e, i))}
            onClick={readOnly ? undefined : (e) => commit(valueFromPointer(e, i))}
            style={{ position: "relative", fontSize: 28, lineHeight: 1, color: "#d1d5db" }}
          >
            ★
            {/* Filled overlay clipped to `fill` percent */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                width: `${fill * 100}%`,
                overflow: "hidden",
                color: "#f59e0b",
              }}
            >
              ★
            </span>
          </span>
        );
      })}
    </div>
  );
}
```

```tsx
// App.tsx
import { useState } from "react";
import { StarRating } from "./StarRating";

export default function App() {
  const [rating, setRating] = useState(0);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <StarRating value={rating} onChange={setRating} allowHalf label="Your rating" />
      <p>Selected: {rating}</p>
      <StarRating value={4.3} readOnly label="Average rating" />
    </div>
  );
}
```

### How half stars are drawn
Two stacked `★` glyphs: a grey one underneath and a gold one on top, with the gold one's container `width` set to `fill * 100%` and `overflow: hidden`. This handles 0.5 and arbitrary fractions like 0.3 with zero extra logic. An SVG with a `linearGradient` stop at `fill` is the other common approach.

### Why `onMouseMove` and not `onMouseEnter`?
With half stars the value changes *within* a single star as the pointer crosses its midpoint. `mouseenter` fires once per star; `mousemove` keeps updating. `onMouseLeave` lives on the **container**, so moving between stars does not flicker back to the committed value.

### Edge cases
- `value` outside `[0, max]` from the parent → clamp before display.
- Touch devices have no hover — the click path still works; hover state never sets.
- `readOnly` with keyboard: `tabIndex=-1` so it is not a dead tab stop. For a pure display, `role="img"` with `aria-label="Rated 4.3 out of 5"` is arguably better.
- Right-to-left layouts flip arrow semantics; check `dir` if the product supports RTL.

## Follow-ups
- **How would you support an uncontrolled mode?** — Accept `defaultValue`, keep internal state, and use `value ?? internal` — the same controlled/uncontrolled pattern as native inputs.
- **How would you use this inside a `<form>` with server actions?** — Render a hidden `<input type="hidden" name="rating" value={value} />` so the value is submitted with `FormData`.
- **Radiogroup vs slider?** — Radiogroup gives each star its own announcement and works naturally with arrow keys in native radios; slider is more compact with fractional steps. Mention the trade-off.

## Common Mistakes
- Storing `filledCount` and `hoverCount` separately and syncing them with effects — the display is derived.
- `onMouseLeave` on each star instead of the container, causing flicker between stars.
- Making every star `tabIndex=0`, creating five tab stops with no announced value.
- Forgetting `aria-hidden` on the glyphs, so a screen reader reads "black star, black star…".

## Tips
- Memorise **`display = hover ?? value`** and **`fill = clamp(display - index, 0, 1)`** — the whole component falls out of those two lines.
- Start with whole stars, get it working, then add half stars by changing only `valueFromPointer` and `step`.
