---
title: "Why does semantic HTML matter? Landmarks, headings and native elements"
level: easy
type: concept
tags: [semantic-html, landmarks, headings, accessibility, native-elements]
related: [html-css/aria-roles-states, html-css/keyboard-focus-basics, html-css/forms-accessibility]
---

## Question
What is semantic HTML and why does it matter for accessibility, SEO and maintainability? Which elements form the page landmarks, and how should headings be structured?

## Interview Answer
Semantic HTML uses elements that describe meaning rather than appearance: `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`, `<button>`, `<a>`, `<ul>`, `<label>`, and so on. Browsers and assistive technology map them to roles with built-in behaviour: a `<button>` is focusable, activates with Enter and Space, and is announced as a button, whereas a `<div onclick>` has none of that. Landmarks let screen reader users jump between regions, headings form an outline users navigate by, and search engines use the structure to understand content. I use native elements first, give each page one `<main>` and one `<h1>`, keep heading levels hierarchical without skipping for styling reasons, and use ARIA only when no native element fits.

## Explanation
### Page skeleton

```html
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header>
    <nav aria-label="Primary">…</nav>
  </header>
  <main id="main">
    <h1>Event loop explained</h1>
    <article>
      <h2>Microtasks</h2>
      …
    </article>
    <aside aria-label="Related questions">…</aside>
  </main>
  <footer>…</footer>
</body>
```

### Landmark roles

| Element | Landmark | Notes |
|---|---|---|
| `<header>` (top-level) | banner | inside `<article>`/`<section>` it is not a landmark |
| `<nav>` | navigation | label multiple navs (`aria-label`) |
| `<main>` | main | exactly one visible per page |
| `<aside>` | complementary | tangential content |
| `<footer>` (top-level) | contentinfo | |
| `<section>` | region (only with an accessible name) | otherwise generic |
| `<form>` | form (only with a name) | |
| `<search>` | search | modern element for search regions |

### Headings
- One `<h1>` describing the page; `h2`–`h6` nest below without skipping levels.
- Choose the level by document structure and style with CSS, not the other way around.
- Screen reader users list headings to scan the page, so avoid empty headings or headings used only for size.

### Native elements give you behaviour for free

| Need | Use | Instead of |
|---|---|---|
| Action | `<button type="button">` | `<div onClick>` |
| Navigation | `<a href>` | `<span onClick={navigate}>` |
| Lists | `<ul>/<ol>/<li>` | stacked divs |
| Data tables | `<table>`, `<th scope>` | grid of divs |
| Disclosure | `<details><summary>` | custom toggle |
| Dialog | `<dialog>` | positioned div + focus script |
| Form control labels | `<label for>` | placeholder text |
| Dates, ranges | `<input type="date|range">` | custom widgets (when adequate) |

```html
<!-- Bad: no role, no keyboard support, no focus -->
<div class="btn" onclick="save()">Save</div>

<!-- Good -->
<button type="button" class="btn" onclick="save()">Save</button>
```

### Other semantics worth knowing
- `<time datetime>`, `<figure>/<figcaption>`, `<mark>`, `<address>`, `<abbr title>`.
- `<img alt>`: meaningful text for informative images; `alt=""` for decorative ones.
- `lang` on `<html>` for pronunciation and hyphenation.
- Buttons in forms default to `type="submit"`; set `type="button"` when not submitting.
- Links vs buttons: links navigate (change URL), buttons perform actions.

### Benefits
1. **Accessibility** with minimal code.
2. **SEO**: clearer document structure and headings.
3. **Maintainability**: elements communicate intent to developers.
4. **Robustness**: works without JS, with reader modes and alternative browsers.
5. **Testing**: Testing Library queries by role (`getByRole("button")`) rely on semantics.

## Follow-ups
- **Is `<section>` a landmark?** — Only if it has an accessible name (`aria-labelledby`/`aria-label`).
- **Can I have two `<main>` elements?** — Only one should be visible at a time.

## Common Mistakes
- Divs with click handlers.
- Skipping heading levels for styling or using headings as styled text.
- Several unlabeled `<nav>` elements.

## Tips
- Mention "free keyboard and screen reader behaviour" and testing by role.
