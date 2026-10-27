---
title: "Cascade layers (@layer), native nesting and @scope"
level: hard
type: concept
tags: [cascade-layers, "@layer", css-nesting, "@scope", specificity, architecture]
related: [html-css/specificity-cascade-inheritance, html-css/tailwind-v4-css-first, html-css/container-queries-has]
---

## Question
What problem do cascade layers solve? How do layers interact with specificity and `!important`, how does native CSS nesting work (and what are its gotchas), and when would you use `@scope`?

## Clues
- Layers sit above specificity in the cascade: a later layer wins regardless of selector specificity.
- Unlayered styles beat all layers for normal declarations.
- `!important` reverses the layer order.

## Interview Answer
Cascade layers let you declare an explicit ordering of groups of styles so conflicts are resolved by layer rather than by selector specificity or file order. You declare the order once (`@layer reset, base, components, utilities;`) and put rules inside layers; for normal declarations a later layer beats an earlier one even if the earlier rule has higher specificity, and unlayered CSS beats all layers. For `!important`, the order flips: important rules in earlier layers win. This is how Tailwind v4 organises output (`theme, base, components, utilities`) and how you can import third-party CSS into a low-priority layer so your styles always win. Native CSS nesting lets you nest rules with `&`, avoiding repetition without a preprocessor, but nested selectors add specificity like their flattened equivalents. `@scope` limits selectors to a DOM subtree with a lower bound, offering proximity-based resolution.

## Explanation
### Layers

```css
@layer reset, base, components, utilities;        /* declare order first */

@layer reset {
  *, *::before, *::after { box-sizing: border-box; margin: 0; }
}

@layer base {
  a { color: var(--link); }
}

@layer components {
  .btn { padding: .5rem 1rem; background: var(--primary); }
}

@layer utilities {
  .p-0 { padding: 0; }                    /* beats .btn padding regardless of specificity */
}
```

Even `#header .btn { padding: 2rem }` in `components` loses to `.p-0` in `utilities`, because layer order is compared before specificity.

### Importing third-party CSS into a layer

```css
@import url("vendor/widget.css") layer(vendor);
@layer vendor, base, components, utilities;       /* vendor is lowest priority */
```

### Rules of the game

| Situation | Winner |
|---|---|
| Two layered rules, different layers (normal) | later layer |
| Layered vs unlayered (normal) | unlayered |
| Same layer | specificity, then order |
| `!important` in layers | earlier layer wins (order reverses) |
| Nested layers `@layer a.b {}` or `@layer a { @layer b {} }` | ordered within parent |
| Anonymous layers (`@layer { … }`) | can't be referenced again |

Layers and the `revert-layer` keyword: roll back a property to what earlier layers set.

### Native nesting

```css
.card {
  padding: 1rem;
  border: 1px solid var(--line);

  & .title { font-weight: 600; }            /* .card .title */
  &:hover { border-color: var(--ring); }    /* .card:hover */
  &.is-active { background: var(--accent); }/* .card.is-active */
  .dark & { background: #111; }             /* .dark .card */

  @media (width >= 40rem) { padding: 2rem; }/* conditional rules can nest */
}
```

Gotchas:
- Nested selectors have the same specificity as the flattened form; `&` takes the specificity of the parent's full selector list (`:is()` semantics, so a parent like `#a, .b` brings the highest specificity into all).
- Declarations after nested rules are fine now (the old "mixed order" quirk was fixed in the final spec).
- Don't nest deeply: more than 2–3 levels hurts readability and specificity.
- Supported in all evergreen browsers since late 2023; the relaxed syntax (no `&` required before type selectors) arrived in 2023–24 versions.

### `@scope`

```css
@scope (.card) to (.card-content) {
  img { border-radius: 8px; }              /* only images inside .card but outside .card-content */
  :scope { padding: 1rem; }                /* the card itself */
}
```

- Style a component without long selectors or naming conventions.
- The lower boundary ("donut scope") prevents styles bleeding into nested components.
- Proximity: when two scopes conflict, the one whose root is closer to the element wins (before source order).
- Support: Chromium and Safari support it; Firefox support arrived later or is behind a flag depending on version, so check before relying on it.

### Using layers in frameworks
- **Tailwind v4** outputs `@layer theme, base, components, utilities;` so utilities beat components regardless of specificity, and your own unlayered CSS beats everything.
- **CSS Modules / CSS-in-JS**: put library styles in a low layer; wrap your component styles in `@layer components`.
- Mixed approaches: ensure unlayered legacy CSS doesn't unintentionally override layered styles (it always wins).

### Strategy
1. Declare layer order at the top of the entry stylesheet.
2. Put resets/third-party in early layers.
3. Keep selectors flat inside layers.
4. Avoid `!important` except for utilities that need it (`!` modifier).
5. Use `revert-layer` for "undo what a previous layer did".

## Follow-ups
- **Why do unlayered styles beat layered ones?** — So legacy or inline-authored CSS isn't suddenly defeated when layers are introduced; layered styles are "opt-in lower priority".
- **Are layers a performance concern?** — No measurable cost in typical use.

## Common Mistakes
- Forgetting the declared order and importing in the wrong sequence.
- Assuming `!important` in a later layer wins.
- Deeply nesting selectors.

## Tips
- Say "layers beat specificity; unlayered beats layers; important flips" in one breath.
