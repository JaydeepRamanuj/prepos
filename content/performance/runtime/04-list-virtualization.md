---
title: "Implement a virtualized (windowed) list"
level: hard
type: implement
tags: [virtualization, windowing, react, scroll, performance, dom-size]
related: [react/list-virtualization, performance/layout-thrashing, performance/long-tasks-main-thread]
---

## Question
Implement a fixed-row-height virtualized list component in React that renders 100,000 rows with only the visible rows (plus overscan) in the DOM. Support smooth scrolling, a configurable height, and discuss variable heights, dynamic content and accessibility.

```tsx
<VirtualList items={rows} itemHeight={36} height={480} overscan={5} renderItem={(row) => <Row data={row} />} />
```

## Clues
- Render a tall spacer to produce the scrollbar, and position the visible slice with a transform.
- Compute the first and last visible indices from `scrollTop`.
- Keep scroll handling cheap: store `scrollTop` in state or a ref plus rAF.

## Interview Answer
Virtualization renders only the rows in or near the viewport and uses an element with the total height to give the scroll container the right scrollbar. For fixed row height, the start index is `floor(scrollTop / itemHeight)` and the end index is `ceil((scrollTop + height) / itemHeight)`; I add overscan rows above and below to avoid blank flashes, then render that slice inside a container translated by `startIndex * itemHeight`. I update `scrollTop` state from a passive scroll listener (batched with `requestAnimationFrame` if needed). Rows get stable keys (item ids), and `renderItem` should be cheap. For variable heights I measure rows (ResizeObserver) and maintain an offsets cache with binary search, or use a library such as TanStack Virtual or react-window. Accessibility needs `role="list"`/`listitem` with `aria-setsize`/`aria-posinset`, keyboard navigation, and attention to find-in-page and focus management, which virtualization breaks.

## Explanation
### Implementation (fixed height)

```tsx
import { useCallback, useState, type ReactNode } from "react";

type Props<T> = {
  items: readonly T[];
  itemHeight: number;
  height: number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => React.Key;
};

export function VirtualList<T>({ items, itemHeight, height, overscan = 5, renderItem, getKey }: Props<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const total = items.length;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(total, Math.ceil((scrollTop + height) / itemHeight) + overscan);
  const visible = items.slice(start, end);

  return (
    <div
      onScroll={onScroll}
      style={{ height, overflowY: "auto", position: "relative" }}
      role="list"
      aria-rowcount={total}
      tabIndex={0}
    >
      {/* spacer gives the scroll container its full scrollable height */}
      <div style={{ height: total * itemHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${start * itemHeight}px)` }}>
          {visible.map((item, i) => {
            const index = start + i;
            return (
              <div
                key={getKey ? getKey(item, index) : index}
                role="listitem"
                aria-posinset={index + 1}
                aria-setsize={total}
                style={{ height: itemHeight }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### Why it works
- DOM nodes: ~(height/itemHeight + 2·overscan) ≈ 20–30 instead of 100,000. Memory, style recalculation, layout and paint costs shrink proportionally.
- The spacer keeps native scrollbar behaviour and momentum scrolling.
- `transform` positioning avoids layout for each scroll update (only compositing).

### Improvements
- **Throttle with rAF**: store the latest scroll offset in a ref and `requestAnimationFrame` a state update, so at most one render per frame.
- **Stable keys** (`item.id`) to preserve row state during scrolling.
- **`React.memo` rows** and cheap `renderItem`; avoid inline object props.
- **Scroll to index**: `container.scrollTop = index * itemHeight`.
- **Sticky headers, grids and horizontal lists**: two-dimensional windowing for tables.
- **Resizing**: use `ResizeObserver` to get container height.

### Variable-height rows
Options:
1. **Known heights** (via a function): precompute a prefix-sum array of offsets; find the start index with binary search; total height is the last offset.
2. **Unknown heights**: render with an estimated height, measure with `ResizeObserver`/`getBoundingClientRect` after render, update the offsets cache, and adjust scroll anchoring; this causes jumps, so libraries add heuristics.
3. **Reverse lists (chat)**: anchor to bottom, keep scroll position when prepending.

```ts
function findStart(offsets: number[], scrollTop: number) {   // largest i with offsets[i] <= scrollTop
  let lo = 0, hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= scrollTop) lo = mid; else hi = mid - 1;
  }
  return lo;
}
```

### Costs and caveats
- **Accessibility**: screen readers only see rendered rows; provide `aria-rowcount`/`aria-posinset`/`aria-setsize`, keyboard navigation (arrow keys, Home/End, PageUp/PageDown) managing focus and scrolling.
- **Find in page (Ctrl+F)** can't search unrendered rows; provide in-app search.
- **Dynamic content** (images loading) changes heights.
- **Focus loss** when a focused row scrolls out and unmounts.
- **SEO**: virtualized content isn't indexable; use pagination for content that must be crawled.
- **Prefer alternatives when possible**: pagination, "load more", `content-visibility: auto` (skips rendering of offscreen sections but keeps DOM), or server-side filtering.

### When to use libraries
TanStack Virtual (headless, supports dynamic sizes, horizontal, grids), react-window/react-virtualized (fixed/variable lists and grids), `virtua`. They handle edge cases like scroll anchoring, smooth scrolling and measuring.

### Testing and measuring
Verify DOM node counts (DevTools), scroll performance with the Performance panel (frames, layout), and keyboard/screen reader behaviour. Add a test that scrolls to the end and asserts the last row renders.

## Follow-ups
- **Why overscan?** — Fast scrolling can outrun rendering, causing blank areas; extra rows buffer it.
- **`content-visibility: auto` vs virtualization?** — CV skips rendering work for offscreen content but keeps nodes in the DOM (memory remains); virtualization removes nodes.

## Common Mistakes
- Using index as key for dynamic lists.
- Heavy row components re-rendering on every scroll.
- Forgetting accessibility attributes.

## Tips
- Write the index maths on the board and mention variable heights via offsets and binary search.
