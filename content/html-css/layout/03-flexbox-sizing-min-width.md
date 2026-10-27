---
title: "Why does my flex item overflow? flex shorthand, min-width: auto and text truncation"
level: hard
type: debugging
tags: [flexbox, flex-shrink, min-width, text-overflow, truncation, flex-basis]
related: [html-css/flexbox-vs-grid, html-css/grid-responsive-layouts, html-css/box-model-sizing]
---

## Question
A chat list row has an avatar, a text block with a long title, and a timestamp. The long title pushes the timestamp out of the container instead of truncating with an ellipsis. Explain why and fix it. Also explain what `flex: 1`, `flex: 1 1 0` and `flex: auto` mean.

```html
<div class="row">
  <img class="avatar" src="a.png" alt="" />
  <div class="text">
    <strong class="title">A very long conversation title that should be truncated…</strong>
    <span class="preview">Latest message…</span>
  </div>
  <time class="time">10:42</time>
</div>
```

```css
.row { display: flex; align-items: center; gap: 12px; width: 320px; }
.text { flex: 1; }
.title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

## Clues
- A flex item cannot shrink below its minimum content size by default.
- Which property overrides that default?
- Truncation needs a bounded width on the element that has `overflow: hidden`.

## Interview Answer
Flex items have `min-width: auto`, which means they won't shrink below their minimum content width. The nowrap title has a large intrinsic width, so `.text` refuses to shrink and overflows, pushing the timestamp away; `overflow: hidden` on the title doesn't help because the parent flex item is the one that's too wide. The fix is to allow `.text` to shrink with `min-width: 0` (or `overflow: hidden`, which also changes the automatic minimum to zero), so `flex: 1` can distribute the remaining space and the ellipsis can work. Also prevent the avatar and time from shrinking with `flex-shrink: 0`. The `flex` shorthand sets `flex-grow`, `flex-shrink` and `flex-basis`: `flex: 1` means `1 1 0%`, `flex: auto` is `1 1 auto`, and `flex: none` is `0 0 auto`.

## Explanation
### Fix

```css
.row { display: flex; align-items: center; gap: 12px; width: 320px; }
.avatar, .time { flex: none; }                          /* don't shrink or grow */
.text { flex: 1; min-width: 0; }                        /* allowed to shrink below content size */
.title, .preview {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

`min-width: 0` (or `overflow: hidden/auto`) makes the automatic minimum size zero. For column direction the equivalent is `min-height: 0`, which matters when making a flex child scrollable inside a flex column (`flex: 1; min-height: 0; overflow: auto`).

### Why `min-width: auto` exists
It prevents flex items from collapsing smaller than their content by default (the "content-based minimum size"). For text it equals the longest unbreakable word/min-content width; for items with `overflow` other than visible it computes to 0.

### The `flex` shorthand

| Shorthand | Expands to | Behaviour |
|---|---|---|
| `flex: 1` | `1 1 0%` | share free space equally; ignore content size when distributing |
| `flex: auto` | `1 1 auto` | start from content size, then grow/shrink |
| `flex: none` | `0 0 auto` | fixed to content/width size |
| `flex: 0 1 auto` (initial) | grow 0, shrink 1, basis auto | natural size; can shrink |
| `flex: 2` | `2 1 0%` | twice the share of free space |
| `flex: 200px` | `1 1 200px` | basis 200px |

Algorithm: start with `flex-basis` (or width), compute free space; distribute positive free space by `flex-grow`, negative space by `flex-shrink` weighted by basis; clamp by min/max sizes.

### Other overflow causes in flex
- Images and long words: set `max-width: 100%`, `overflow-wrap: anywhere` or `word-break`.
- Nested flex containers need `min-width: 0` at each level.
- `width: 100%` plus padding with `content-box` overflows; use `border-box`.
- `flex-wrap: wrap` to let items break lines instead of shrinking.
- Grid equivalent: use `minmax(0, 1fr)` instead of `1fr` so tracks can shrink below content.

### Multi-line clamp

```css
.title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

`line-clamp: 2` is becoming standard; the prefixed form is widely supported today.

### Debugging checklist
1. Inspect the flex item: what is its computed min-width and flex-basis?
2. Temporarily add `outline` to see which box is too wide.
3. Try `min-width: 0` on each ancestor flex item from the offender upward.

## Follow-ups
- **Why does `overflow: hidden` on the parent not fix this?** — The overflowing element is the flex item; the content still dictates its size.
- **Difference between `flex-basis` and `width`?** — `flex-basis` sets the initial main size in the flex axis and takes precedence over `width` unless `auto`.

## Common Mistakes
- Adding `text-overflow: ellipsis` without constraining the width chain.
- Using `flex: 1` and expecting equal widths when content differs (use `flex: 1 1 0` and `min-width: 0`).

## Tips
- Memorise "min-width: 0 on the flex item" as the first thing to try.
