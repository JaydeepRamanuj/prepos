---
title: "The cascade: specificity, order, origin, inheritance and !important"
level: medium
type: concept
tags: [specificity, cascade, inheritance, important, :where, :is]
related: [html-css/cascade-layers-nesting, html-css/tailwind-utility-first-tradeoffs, html-css/box-model-sizing]
---

## Question
How does the browser decide which CSS declaration wins when multiple rules target the same element? Explain specificity, source order, origin and importance, inheritance, and how `:is()`, `:where()` and `:not()` affect specificity.

## Interview Answer
The cascade resolves conflicts by comparing, in order: origin and importance (user-agent, user and author styles, with `!important` reversing the order), then cascade layers, then specificity, then source order as the final tiebreaker. Specificity is a tuple counted as (IDs, classes/attributes/pseudo-classes, elements/pseudo-elements): `#nav .item a` is (1,1,1) and beats any number of classes. Inline styles outrank selectors, and `!important` outranks normal declarations. Inheritance is separate: some properties (color, font, line-height, visibility) inherit by default when no rule sets a value; others (margin, border, background) don't, and `inherit`, `initial`, `unset` and `revert` control it. `:where()` has zero specificity, `:is()` and `:not()` take the specificity of their most specific argument, and `:has()` too. In practice I keep specificity low and flat (classes), rely on order and layers rather than `!important`, and use `:where()` for resettable defaults.

## Explanation
### Resolution order

1. **Origin & importance**: transition > `!important` UA > `!important` user > `!important` author > author normal > user normal > UA normal (animations sit between).
2. **Context** (shadow DOM scoping rules).
3. **Element-attached styles**: inline `style=""` beat selectors.
4. **Layers**: for normal declarations, later layers win; unlayered styles beat layered ones (reversed for `!important`).
5. **Specificity**.
6. **Scoping proximity** (`@scope`).
7. **Order of appearance**: last wins.

### Specificity arithmetic

| Selector | (ID, class, type) |
|---|---|
| `*` | 0,0,0 |
| `li` | 0,0,1 |
| `ul li` | 0,0,2 |
| `.card` | 0,1,0 |
| `a:hover` | 0,1,1 |
| `.nav > .item.active` | 0,3,0 |
| `#header .nav a` | 1,1,1 |
| `[type="text"]` | 0,1,0 |
| `:is(#a, .b)` | 1,0,0 (max of arguments) |
| `:where(#a, .b)` | 0,0,0 |
| `:not(.x)` | 0,1,0 |

Compare left to right: any ID beats any number of classes; classes beat types. 11 classes do not beat 1 ID (no carry-over).

```css
:where(a) { color: blue; }            /* specificity 0: any class overrides it */
.link { color: red; }                 /* wins regardless of order */
```

### Inheritance

```css
body { font: 16px/1.5 system-ui; color: #222; }   /* inherited by descendants */
p { margin: 0; }                                   /* margin is not inherited */
.reset { all: unset; }                             /* resets everything */
.keep { color: inherit; border-color: currentcolor; }
```

| Keyword | Effect |
|---|---|
| `inherit` | take parent's computed value |
| `initial` | spec default |
| `unset` | `inherit` for inherited props, `initial` otherwise |
| `revert` | roll back to the user-agent/user value |
| `revert-layer` | roll back to the previous layer |

Custom properties (`--x`) inherit by default, which is why theming via CSS variables works.

### `!important`
Use sparingly: it can only be beaten by another `!important` with higher precedence. Legitimate uses: utility overrides (Tailwind's `!` modifier), accessibility overrides (user styles), third-party CSS you can't edit. Prefer layers: `!important` in an earlier layer wins over later layers (the order flips), which is a trap.

### Practical strategy
- Flat selectors, mostly single classes (BEM, CSS Modules, Tailwind).
- Avoid IDs in CSS and avoid chaining `.a.b.c` to win fights.
- Use `@layer` for ordering (reset < base < components < utilities).
- Use `:where()` in resets and library defaults so consumers override easily.
- Debug with DevTools "Styles" pane: struck-through rules lost; computed tab shows the winning source.
- Nesting (`&`) adds the parent's specificity: `.card { & .title {} }` is `.card .title`.

## Follow-ups
- **Does source order across files matter?** — Yes: the order stylesheets load decides ties; bundlers/frameworks control that order, which is why layers help.
- **Specificity of `style` attribute?** — Higher than any selector, but lower than `!important` in a stylesheet.

## Common Mistakes
- Fighting specificity with more specificity or `!important`.
- Assuming 11 classes beat an ID.
- Forgetting `:is()` takes the highest specificity.

## Tips
- Write the tuple for two selectors on the whiteboard; that's usually all it takes.
