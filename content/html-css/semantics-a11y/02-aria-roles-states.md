---
title: "ARIA: when to use it, the first rule, and accessible names"
level: medium
type: concept
tags: [aria, accessible-name, roles, aria-live, aria-expanded, labelledby]
related: [html-css/semantic-html-landmarks, html-css/forms-accessibility, html-css/accessible-widgets-roving-focus]
---

## Question
What is ARIA and what is its first rule? Explain roles, states and properties, how an accessible name is computed (`aria-label` vs `aria-labelledby` vs native labels), and when to use live regions.

## Interview Answer
ARIA (Accessible Rich Internet Applications) is a set of attributes that add semantics for assistive technology when native HTML can't express them. Its first rule is not to use ARIA if a native element or attribute already provides the semantics and behaviour, because ARIA changes only what is announced, not how the element behaves: `role="button"` on a div adds no keyboard support. Roles say what something is (`dialog`, `tab`, `alert`), properties describe relationships and labels (`aria-labelledby`, `aria-controls`), and states change with interaction (`aria-expanded`, `aria-selected`, `aria-checked`). Every interactive element needs an accessible name, computed from content, `<label>`, `aria-labelledby`, `aria-label` or `title` in a defined order. For dynamic announcements I use live regions (`role="status"`, `aria-live="polite"`, or `role="alert"` for urgent messages). Incorrect ARIA is worse than none, so I test with a screen reader and the accessibility tree.

## Explanation
### The five rules, in short
1. Prefer native HTML.
2. Don't change native semantics unless you must (`<h2 role="tab">` is wrong; wrap instead).
3. All interactive ARIA controls must be keyboard operable.
4. Don't hide focusable elements (`aria-hidden="true"` on something focusable).
5. All interactive elements need an accessible name.

### Roles, properties, states

```html
<button aria-expanded="false" aria-controls="menu-1">Menu</button>
<ul id="menu-1" hidden>…</ul>

<div role="tablist" aria-label="Sections">
  <button role="tab" aria-selected="true" aria-controls="p1" id="t1">One</button>
</div>
<div role="tabpanel" id="p1" aria-labelledby="t1">…</div>
```

Update states in JS when the UI changes (`aria-expanded`, `aria-selected`, `aria-pressed`, `aria-current="page"`).

### Accessible name computation (simplified order)

1. `aria-labelledby` (references other elements' text).
2. `aria-label` (string).
3. Native label mechanisms: `<label for>`, `alt` on images, `<legend>` for fieldsets, `<caption>`.
4. Text content (for buttons, links, headings...).
5. `title` or `placeholder` (last resort).

```html
<button aria-label="Close dialog"><svg aria-hidden="true">…</svg></button>   <!-- icon-only button -->
<h2 id="cart-title">Cart</h2>
<section aria-labelledby="cart-title">…</section>                              <!-- region with a name -->
<a href="/cart">Cart <span class="sr-only">(3 items)</span></a>               <!-- visually hidden text -->
```

Don't put the accessible name only in `placeholder` or `title`. Visible label text should be contained in the accessible name (WCAG "Label in Name"), so voice control users can say what they see.

### Live regions

```html
<div role="status">Saved</div>                       <!-- polite, atomic-ish: announced when text changes -->
<div role="alert">Payment failed</div>               <!-- assertive: interrupts -->
<div aria-live="polite" aria-atomic="true" id="sr-updates"></div>
```

- The live region container must exist in the DOM before content changes (inserting a new `role="alert"` node usually still works; for `status`/polite regions insert the container first, update the text later).
- Use for form validation summaries, toasts, search result counts, loading complete messages.
- Avoid chatty regions (timers, constantly updating values).

### Hiding things

| Technique | Visual | Screen reader | Focusable |
|---|---|---|---|
| `display: none`, `hidden` | hidden | hidden | no |
| `visibility: hidden` | hidden | hidden | no |
| `aria-hidden="true"` | visible | hidden | still focusable (bug source) |
| `.sr-only` (clip) | hidden | read | yes |
| `inert` | visible | hidden | no, and not interactive |

`inert` is the right tool for background content behind a modal.

### Common patterns
- `aria-current="page"` on the active nav link.
- `aria-describedby` for hints and error messages on inputs.
- `aria-invalid="true"` for invalid fields; `aria-required` is redundant with `required`.
- `aria-busy="true"` while content loads.
- `aria-pressed` for toggle buttons; `aria-checked` for custom checkboxes/switches (`role="switch"`).
- `role="presentation"`/`"none"` to remove semantics (e.g. layout tables).

### Testing
Chrome DevTools Accessibility pane shows the computed role and name; axe DevTools/jest-axe catches many violations; always test keyboard and one screen reader (NVDA/VoiceOver).

## Follow-ups
- **`aria-label` vs `aria-labelledby`?** — `labelledby` points to visible text (preferred); `label` is a string for when no visible text exists.
- **Does `role="button"` make a div a button?** — No: it needs `tabindex="0"` and key handlers; just use `<button>`.

## Common Mistakes
- Adding ARIA roles to native elements redundantly (`<button role="button">`).
- `aria-hidden` on focusable content.
- Forgetting to update `aria-expanded`.

## Tips
- Quote rule one and the accessible-name order.
