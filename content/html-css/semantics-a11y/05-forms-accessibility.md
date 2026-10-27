---
title: "Accessible forms: labels, errors, autocomplete and grouping"
level: medium
type: concept
tags: [forms, labels, aria-describedby, autocomplete, fieldset, validation, error-messages]
related: [react/form-validation-ux, html-css/aria-roles-states, html-css/semantic-html-landmarks]
---

## Question
What makes a form accessible? Cover labels, hints and error messages, grouping, required fields, `autocomplete`, input types, and how to announce validation errors.

## Interview Answer
Every control needs a programmatically associated visible label (`<label for>` or wrapping), because placeholders disappear and aren't reliable names. Hints and errors are linked with `aria-describedby`, invalid fields get `aria-invalid="true"`, and error text is visible, specific and not conveyed by colour alone. Related controls (radio groups, address blocks) are grouped with `<fieldset>` and `<legend>`. I use the right `type` (`email`, `tel`, `number` when appropriate), `inputmode`, and `autocomplete` tokens (`email`, `given-name`, `current-password`) so browsers and password managers help and users with motor or cognitive impairments type less. On submit I move focus to the first invalid field or an error summary and announce it (`role="alert"` or focus on the summary), and I avoid disabling the submit button as the only feedback. Required fields use the `required` attribute and a visible indicator explained to users.

## Explanation
### Labels, hints, errors

```html
<div class="field">
  <label for="email">Email address</label>
  <input
    id="email" name="email" type="email" autocomplete="email" required
    aria-describedby="email-hint email-error"
    aria-invalid="true"
  />
  <p id="email-hint" class="hint">We'll send a receipt here.</p>
  <p id="email-error" class="error">Enter an email address like name@example.com</p>
</div>
```

Screen readers read the label, then the description (hint and error), plus "invalid entry". Remove `aria-invalid` and the error element when the field is valid.

### Groups

```html
<fieldset>
  <legend>Delivery speed</legend>
  <label><input type="radio" name="speed" value="std" checked> Standard</label>
  <label><input type="radio" name="speed" value="exp"> Express</label>
</fieldset>
```

The legend is announced with each radio ("Delivery speed, Standard, radio button, 1 of 2").

### Autocomplete and input types

| Field | Attributes |
|---|---|
| Email | `type="email" autocomplete="email"` |
| Phone | `type="tel" autocomplete="tel" inputmode="tel"` |
| One-time code | `autocomplete="one-time-code" inputmode="numeric"` |
| New password | `type="password" autocomplete="new-password"` |
| Credit card | `autocomplete="cc-number" inputmode="numeric"` |
| Name | `autocomplete="name"` / `given-name` / `family-name` |

WCAG 1.3.5 (Identify Input Purpose) requires `autocomplete` for common personal fields. Avoid `type="number"` for IDs, phone numbers or ZIP codes (use `inputmode="numeric"` with `pattern`).

### Error handling flow

```html
<form novalidate aria-describedby="form-errors">
  <div id="form-errors" role="alert" tabindex="-1" hidden>
    <h2>There are 2 problems</h2>
    <ul>
      <li><a href="#email">Enter a valid email</a></li>
      <li><a href="#password">Password must be at least 8 characters</a></li>
    </ul>
  </div>
  …
</form>
```

1. Validate on submit (and after blur once touched).
2. Show an error summary with links to fields, move focus to it (or to the first invalid field).
3. Inline errors next to each field.
4. Keep entered values after errors.
5. Provide suggestions, not just "Invalid input".

### Required and optional
Use `required` (and the visible marker with explanation: "* required"), or mark optional ones. Don't rely on colour or asterisks without text. `aria-required` is redundant when `required` is used on native inputs.

### Visual design requirements
- Label text visible, positioned consistently (above is best for mobile).
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for borders/focus indicators of controls.
- Touch targets at least 24×24 CSS px (WCAG 2.2 AA minimum), preferably 44×44.
- Error indication uses icon + text, not colour alone.
- Don't remove the focus outline.

### Don't
- Use placeholder as the only label.
- Use `title` for hints.
- Auto-advance focus between fields.
- Disable paste on password or code fields.
- Time out silently; warn and allow extension.
- Use "click here"-like instructions that depend on layout.

### Frameworks
React Hook Form and Formik don't handle accessibility attributes automatically: wire `aria-invalid`/`aria-describedby` yourself, or use primitives from Radix/React Aria. Testing Library: `getByLabelText`, `getByRole("textbox", { name })`, `toBeInvalid`, and `toHaveAccessibleDescription` verify the wiring.

## Follow-ups
- **Why not use `placeholder` as a label?** — It vanishes on input, often has poor contrast, and isn't consistently exposed as a name.
- **`aria-describedby` vs `aria-errormessage`?** — `aria-errormessage` is meant for errors with `aria-invalid`, but support is uneven; `aria-describedby` is the safer choice.

## Common Mistakes
- Error messages only in red.
- Not linking errors to inputs.
- Moving focus nowhere after a failed submit.

## Tips
- Walk the flow: label, hint, error wiring, summary focus.
