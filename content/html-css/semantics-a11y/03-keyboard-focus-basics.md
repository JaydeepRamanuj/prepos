---
title: "Keyboard accessibility: focus order, tabindex, focus-visible and skip links"
level: medium
type: concept
tags: [keyboard, focus, tabindex, focus-visible, skip-link, outline]
related: [html-css/semantic-html-landmarks, html-css/accessible-modal-dialog, html-css/accessible-widgets-roving-focus]
---

## Question
How does keyboard navigation work in the browser? Explain tab order, `tabindex` values, `:focus` vs `:focus-visible`, why you shouldn't remove outlines, and how to implement a skip link.

## Interview Answer
Keyboard users move through interactive elements with Tab (and Shift+Tab), in DOM order. Native controls (links with `href`, buttons, inputs, selects, textareas, `summary`, elements with `contenteditable`) are focusable by default. `tabindex="0"` makes a non-interactive element focusable in natural order, `tabindex="-1"` makes it focusable by script only (for example to move focus to a heading after navigation), and positive values should be avoided because they override the natural order and are hard to maintain. Focus must always be visible: removing `outline` without replacement is a WCAG failure, and `:focus-visible` shows the ring for keyboard focus but not for mouse clicks on buttons. A skip link as the first focusable element lets users bypass repeated navigation. Visual order, DOM order and focus order should match, so avoid reordering with CSS (`order`, grid placement) in ways that scramble tabbing.

## Explanation
### What is focusable

| Element | Focusable by default |
|---|---|
| `<a href>`, `<button>`, `<input>`, `<select>`, `<textarea>`, `<summary>` | yes |
| `<a>` without `href` | no |
| `<div>`, `<span>` | no (add `tabindex`) |
| Disabled form controls | no |
| `tabindex="0"` | yes, in DOM order |
| `tabindex="-1"` | script only (`el.focus()`) |
| `tabindex="3"` | jumps ahead of others: avoid |

### Focus styles

```css
/* Keep the default outline, or replace it with something at least as visible */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Never do this without a replacement */
*:focus { outline: none; }          /* WCAG 2.4.7 failure */
```

- `:focus` matches any focus; `:focus-visible` matches when the browser decides a visible indicator is helpful (keyboard, or text inputs even with mouse).
- WCAG 2.2 adds Focus Appearance guidance: sufficient size and contrast (3:1) for the indicator.
- `:focus-within` styles a container when any child is focused.

### Skip link

```html
<a class="skip-link" href="#main">Skip to main content</a>
<nav>…20 links…</nav>
<main id="main" tabindex="-1">…</main>
```

```css
.skip-link {
  position: absolute;
  left: 8px;
  top: -48px;                         /* off-screen until focused */
  padding: 8px 12px;
  background: Canvas;
  z-index: 100;
}
.skip-link:focus { top: 8px; }
```

`tabindex="-1"` on the target ensures focus actually moves there in all browsers after the hash navigation.

### Managing focus in SPAs
On client-side route changes the browser doesn't reset focus, so screen reader and keyboard users are left on the old link. Move focus to the new page heading or `<main>` (`tabindex="-1"`, `el.focus()`) and announce the title change. Next.js announces route changes via a live region; verify focus behaviour in your app.

### Keyboard interaction basics
- Enter activates links and buttons; Space activates buttons and checkboxes.
- Arrow keys move within composite widgets (tabs, menus, radio groups); Tab moves between widgets.
- Escape dismisses overlays; returns focus to the trigger.
- Don't trap focus except in modal dialogs, and always provide a way out.
- Avoid keyboard shortcuts that conflict with assistive tech; allow single-key shortcuts to be turned off (WCAG 2.1.4).

### Order pitfalls
- `order` in flexbox/grid or `flex-direction: row-reverse` changes visual order but not tab order.
- `position: absolute` elements may appear far from their DOM position.
- Hidden-but-focusable elements (`opacity: 0` off-canvas menus) trap tabbing: use `hidden`, `display: none` or `inert`.

### Testing
Unplug the mouse. Tab through the page: can you reach every control, see where you are, operate it, and leave it? Check with browsers' tabbing and the Accessibility tree; use Playwright with `keyboard.press("Tab")` for regression tests.

## Follow-ups
- **Why avoid positive tabindex?** — It creates a separate tab sequence that breaks as content changes and is confusing.
- **`outline: none` for aesthetics?** — Replace it with a custom focus-visible style instead.

## Common Mistakes
- Removing outlines globally.
- Using `tabindex="0"` on everything.
- Off-screen menus that remain tabbable.

## Tips
- Say "DOM order = visual order = focus order" and mention SPA focus management.
