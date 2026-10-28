---
title: "How would you render a list of 10,000 rows without freezing the page?"
level: hard
type: implement
tags: [virtualization, windowing, lists, performance, scroll]
related: [react/react-memo-new-props, react/react-profiler, performance/list-virtualization]
---

## Question
A table needs to show 10,000 rows of fixed height (40px) inside a 600px-tall scroll container. Rendering them all takes seconds and makes scrolling janky. Explain virtualization and implement a minimal `VirtualList` component from scratch.

```tsx
<VirtualList
  items={rows}
  rowHeight={40}
  height={600}
  renderRow={(row) => <RowView row={row} />}
/>
```

## Clues
- Only about 15 rows are visible at any time. Why render the other 9,985?
- Keep the scrollbar honest: the inner container must still be `items.length * rowHeight` tall.
- From `scrollTop`, compute `startIndex`, then absolutely position the rows that are actually visible (plus a few extra).

## Interview Answer
Virtualization, or windowing, renders only the rows inside the viewport plus a small overscan buffer, so the DOM holds about 20 nodes instead of 10,000. I keep a spacer element whose height equals the total height of the list, so the scrollbar behaves as if every row exists. On scroll, I read `scrollTop`, compute `startIndex = floor(scrollTop / rowHeight)` and the number of visible rows, and render that slice with each row absolutely positioned at `index * rowHeight`. Fixed row heights make the maths trivial. Variable heights need measurement and a position cache, which is why in production I would use TanStack Virtual or react-window instead of writing my own.

## Explanation
### The mental model

```txt
┌ scroll container (height 600, overflow auto) ┐
│ ┌ spacer (height 10,000 × 40 = 400,000px) ┐  │
│ │   rows 0–149  ... not rendered           │  │
│ │ ▶ row 150  top: 6000px   ← rendered      │  │
│ │ ▶ ...                                    │  │
│ │ ▶ row 170  top: 6800px   ← rendered      │  │
│ │   rows 171+ ... not rendered             │  │
│ └──────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

### Implementation

```tsx
import { useState, type ReactNode, type UIEvent } from "react";

type Props<T> = {
  items: T[];
  rowHeight: number;
  height: number;              // viewport height in px
  overscan?: number;           // extra rows above and below
  renderRow: (item: T, index: number) => ReactNode;
};

export function VirtualList<T>({
  items, rowHeight, height, overscan = 5, renderRow,
}: Props<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * rowHeight;
  const visibleCount = Math.ceil(height / rowHeight);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, start + visibleCount + overscan * 2);

  const rows = [];
  for (let i = start; i < end; i++) {
    rows.push(
      <div
        key={i} // stable as long as the list is not reordered; prefer item ids if you have them
        style={{ position: "absolute", top: i * rowHeight, height: rowHeight, left: 0, right: 0 }}
      >
        {renderRow(items[i], i)}
      </div>,
    );
  }

  return (
    <div
      style={{ height, overflowY: "auto", position: "relative" }}
      onScroll={(e: UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>{rows}</div>
    </div>
  );
}
```

Why each piece matters:
- **The spacer's height** keeps the native scrollbar size and position correct.
- **Overscan** renders a few extra rows, so fast scrolling does not briefly show blank space.
- **Absolute positioning** places rows without rendering the ones in between.
- **Reading `currentTarget.scrollTop`** in the handler keeps it a single state update per scroll event. React batches updates, so this stays smooth.

### Edge cases and trade-offs
- **Variable row heights**: you need to measure rendered rows (with a `ResizeObserver`), cache their offsets and binary-search `scrollTop` to find the start index. Libraries do this for you. TanStack Virtual's `measureElement` is the usual choice.
- **Find-in-page (Ctrl+F) and SEO** do not see off-screen rows.
- **Accessibility**: screen readers see only the rendered rows. Set `aria-rowcount` / `aria-rowindex` on table semantics.
- **Keeping row state** (such as an expanded row): rows unmount when they scroll out of view, so store that state by id in the parent.
- **Alternatives**: for long pages that are not app-like, CSS `content-visibility: auto` skips rendering off-screen content with no JavaScript, and pagination or infinite loading may be a better product decision.

### Complexity
Each render is O(visible rows) instead of O(n). The `items` array itself is still in memory, but DOM nodes, layout and paint costs stay flat.

## Follow-ups
- **Why not just `React.memo` every row?** Memo saves re-render work, but mounting 10,000 DOM nodes, the layout and the memory are still expensive. Virtualization removes the nodes.
- **How do you scroll to row 5,000?** Set `container.scrollTop = 5000 * rowHeight` through a ref.
- **What about infinite scroll?** Combine the two: virtualize what is loaded, and fetch the next page when `end` gets close to `items.length`.

## Common Mistakes
- Forgetting the spacer, so the scrollbar is tiny and you can only scroll through the rendered rows.
- No overscan, which causes white flashes while scrolling.
- Keying rows by the position inside the slice (`0..20`) instead of the absolute index or id. Rows then remount or mix up their state on scroll.

## Tips
- Draw the box diagram first, then write the three formulas: `totalHeight`, `start`, `end`.
- Say "in production I'd use TanStack Virtual" after showing that you understand how it works. Interviewers want both.
